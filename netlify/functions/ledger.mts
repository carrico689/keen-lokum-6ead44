import { getUser, verifyRequestOrigin } from '@netlify/identity'
import type { Config } from '@netlify/functions'
import { and, desc, eq, or } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { accounts, transactions, activity } from '../../db/schema.js'
import { accessFor, accessList } from '../lib/access.js'
import { parseMoney } from '../../src/lib/ledger.js'

class InputError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

function text(value: unknown, label: string, maximum: number, optional = false) {
  if (typeof value !== 'string' || (!optional && !value.trim()) || value.trim().length > maximum) {
    throw new InputError(`${label} ${optional ? 'must be text and' : 'is required and must be'} at most ${maximum} characters.`)
  }
  return value.trim()
}

function uuid(value: unknown) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new InputError('Choose a valid account or transaction.')
  return value
}

function version(value: unknown) {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) throw new InputError('Refresh the page before editing this record.')
  return new Date(value)
}

export default async (request: Request) => {
  const headers = { 'Cache-Control': 'private, no-store' }
  try {
    const user = await getUser()
    if (!user?.confirmedAt) return Response.json({ error: 'Sign in to open REGIONS.' }, { status: 401, headers })
    const access = await accessFor(user.email)
    if (!access) return Response.json({ error: 'Your account does not have access to REGIONS.' }, { status: 403, headers })
    if (request.method === 'GET') {
      const [allAccounts, allTransactions, recentActivity] = await db.transaction((session) => Promise.all([
        session.select().from(accounts).orderBy(accounts.createdAt),
        session.select().from(transactions).orderBy(desc(transactions.date), desc(transactions.createdAt), desc(transactions.id)),
        session.select({ id: activity.id, actorName: activity.actorName, action: activity.action, description: activity.description, createdAt: activity.createdAt }).from(activity).orderBy(desc(activity.createdAt)).limit(100),
      ]), { isolationLevel: 'repeatable read', accessMode: 'read only' })
      return Response.json({
        user: { name: access.name, role: access.role },
        accounts: allAccounts,
        transactions: allTransactions.map(({ createdBy: _createdBy, ...transaction }) => transaction),
        activity: recentActivity,
        access: access.role === 'editor' ? await accessList() : [],
      }, { headers })
    }
    if (!['POST', 'PATCH', 'DELETE'].includes(request.method)) return Response.json({ error: 'Method not allowed.' }, { status: 405, headers })
    verifyRequestOrigin(request)
    if (access.role !== 'editor') return Response.json({ error: 'View-only access cannot change REGIONS.' }, { status: 403, headers })
    if (!request.headers.get('content-type')?.includes('application/json')) throw new InputError('Send a JSON request.')
    const rawBody = await request.text()
    if (rawBody.length > 16000) throw new InputError('This entry is too large.')
    let body: Record<string, unknown>
    try { body = JSON.parse(rawBody) } catch { throw new InputError('Invalid request.') }
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new InputError('Invalid request.')
    const entity = body.entity
    if (entity !== 'account' && entity !== 'transaction') throw new InputError('Choose an account or transaction.')
    const id = request.method === 'POST' ? undefined : uuid(body.id)
    const updatedAt = request.method === 'POST' ? undefined : version(body.updatedAt)
    const result = await db.transaction(async (session) => {
      const action = request.method === 'POST' ? 'added' : request.method === 'PATCH' ? 'updated' : 'deleted'
      let record: { id: string; name?: string; description?: string } | undefined
      if (entity === 'account') {
        if (request.method === 'DELETE') {
          const [existing] = await session.select({ id: transactions.id }).from(transactions).where(or(eq(transactions.accountId, id!), eq(transactions.destinationId, id!))).limit(1)
          if (existing) throw new InputError('This account has transactions. Remove or reassign its transactions before deleting it.')
          ;[record] = await session.delete(accounts).where(and(eq(accounts.id, id!), eq(accounts.updatedAt, updatedAt!))).returning()
        } else {
          const openingCents = typeof body.openingBalance === 'string' ? parseMoney(body.openingBalance, true) : null
          if (openingCents === null) throw new InputError('Enter an opening balance with no more than two decimal places.')
          const accountNumber = text(body.accountNumber, 'Account number', 34)
          if (!/^[a-zA-Z0-9 -]{3,34}$/.test(accountNumber)) throw new InputError('Use 3–34 letters, numbers, spaces, or dashes for the account number.')
          const color = typeof body.color === 'string' && ['green', 'blue', 'sand', 'purple'].includes(body.color) ? body.color : 'green'
          const values = { name: text(body.name, 'Account name', 80), accountNumber, openingCents, color }
          if (request.method === 'POST') [record] = await session.insert(accounts).values(values).returning()
          else [record] = await session.update(accounts).set({ ...values, updatedAt: new Date() }).where(and(eq(accounts.id, id!), eq(accounts.updatedAt, updatedAt!))).returning()
        }
      } else if (request.method === 'DELETE') {
        ;[record] = await session.delete(transactions).where(and(eq(transactions.id, id!), eq(transactions.updatedAt, updatedAt!))).returning()
      } else {
        const kind = body.type
        if (kind !== 'deposit' && kind !== 'withdrawal' && kind !== 'transfer') throw new InputError('Choose a transaction type.')
        const amountCents = typeof body.amount === 'string' ? parseMoney(body.amount) : null
        if (!amountCents || amountCents <= 0) throw new InputError('Enter an amount greater than zero with no more than two decimal places.')
        const date = text(body.date, 'Date', 10)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) !== date || date < '1900-01-01' || date > '2100-12-31') throw new InputError('Enter a valid date between 1900 and 2100.')
        const accountId = uuid(body.accountId)
        const destinationId = kind === 'transfer' ? uuid(body.destinationId) : null
        if (accountId === destinationId) throw new InputError('Choose a different destination account.')
        const sourceAccounts = await session.select({ id: accounts.id }).from(accounts).where(destinationId ? or(eq(accounts.id, accountId), eq(accounts.id, destinationId)) : eq(accounts.id, accountId))
        if (sourceAccounts.length !== (destinationId ? 2 : 1)) throw new InputError('One of these accounts no longer exists. Refresh and try again.')
        const values = { accountId, destinationId, type: kind, date, description: text(body.description, 'Description', 160), amountCents, notes: text(body.notes ?? '', 'Notes', 1000, true) }
        if (request.method === 'POST') [record] = await session.insert(transactions).values({ ...values, createdBy: user.id }).returning()
        else [record] = await session.update(transactions).set({ ...values, updatedAt: new Date() }).where(and(eq(transactions.id, id!), eq(transactions.updatedAt, updatedAt!))).returning()
      }
      if (!record) throw new InputError('This record changed or was deleted by someone else. Refresh REGIONS and try again.', 409)
      await session.insert(activity).values({ actorId: user.id, actorName: access.name, action: `${entity} ${action}`, entityId: record.id, description: record.name ?? record.description ?? entity })
      return record
    })
    return Response.json({ record: result }, { status: request.method === 'POST' ? 201 : 200, headers })
  } catch (error) {
    if (error instanceof InputError) return Response.json({ error: error.message }, { status: error.status, headers })
    if (typeof error === 'object' && error && 'status' in error && error.status === 403) return Response.json({ error: 'This request is not allowed.' }, { status: 403, headers })
    if (typeof error === 'object' && error && ('code' in error || 'cause' in error)) {
      const code = 'code' in error ? error.code : typeof error.cause === 'object' && error.cause && 'code' in error.cause ? error.cause.code : undefined
      if (code === '23505') return Response.json({ error: 'An account with this number already exists.' }, { status: 409, headers })
      if (code === '23503') return Response.json({ error: 'This account is in use or no longer exists. Refresh REGIONS.' }, { status: 409, headers })
    }
    return Response.json({ error: 'REGIONS is temporarily unavailable. Your changes have not been confirmed. Please refresh and try again.' }, { status: 503, headers })
  }
}

export const config: Config = { path: '/api/ledger' }
