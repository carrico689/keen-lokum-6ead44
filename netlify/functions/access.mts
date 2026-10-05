import { getIdentityConfig, getUser, verifyRequestOrigin, admin } from '@netlify/identity'
import type { Config } from '@netlify/functions'
import { sql } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { activity, invitations, viewerMembers } from '../../db/schema.js'
import { accessFor } from '../lib/access.js'

export default async (request: Request) => {
  const headers = { 'Cache-Control': 'private, no-store' }
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed.' }, { status: 405, headers })
  try {
    verifyRequestOrigin(request)
    const rawBody = await request.text()
    if (rawBody.length > 2000) return Response.json({ error: 'This request is too large.' }, { status: 400, headers })
    let body: { email?: unknown; name?: unknown; action?: unknown }
    try { body = JSON.parse(rawBody) } catch { return Response.json({ error: 'Enter a valid email address.' }, { status: 400, headers }) }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return Response.json({ error: 'Enter a valid email address.' }, { status: 400, headers })
    if (typeof body.email !== 'string' || body.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
      return Response.json({ error: 'Enter a valid email address.' }, { status: 400, headers })
    }
    if (body.action !== undefined && body.action !== 'inviteViewer') return Response.json({ error: 'Invalid invitation request.' }, { status: 400, headers })
    const inviteViewer = body.action === 'inviteViewer'
    let invitingUser
    let invitingAccess
    if (inviteViewer) {
      invitingUser = await getUser()
      if (!invitingUser?.confirmedAt) return Response.json({ error: 'Sign in to invite a viewer.' }, { status: 401, headers })
      invitingAccess = await accessFor(invitingUser.email)
      if (invitingAccess?.role !== 'editor') return Response.json({ error: 'Only team editors can invite viewers.' }, { status: 403, headers })
      if (body.name !== undefined && (typeof body.name !== 'string' || body.name.trim().length > 100)) return Response.json({ error: 'Use a name of at most 100 characters.' }, { status: 400, headers })
    }
    const email = body.email.trim().toLowerCase()
    let access = await accessFor(email)
    if (inviteViewer && access?.role === 'editor') return Response.json({ error: 'This person already has team editing access. This form only invites viewers.' }, { status: 409, headers })
    const message = 'If this email has access, check your inbox and spam folder for your invitation. If you already have an account, sign in or reset your password. Allow five minutes before requesting another invitation.'
    if (!access && !inviteViewer) return Response.json({ message }, { headers })
    const identity = getIdentityConfig()
    if (!identity?.token) return Response.json({ error: 'Email invitations are not available yet. Please try again after the site is published.' }, { status: 503, headers })
    if (!access && invitingUser && invitingAccess) {
      const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : email
      await db.transaction(async (session) => {
        const [member] = await session.insert(viewerMembers).values({ email, name, invitedBy: invitingUser.id }).onConflictDoNothing().returning()
        if (member) await session.insert(activity).values({ actorId: invitingUser.id, actorName: invitingAccess.name, action: 'viewer.added', entityId: member.id, description: `View-only access granted to ${name}` })
      })
      access = await accessFor(email)
    }
    if (!access) return Response.json({ error: 'Viewer access could not be saved. Please try again.' }, { status: 503, headers })
    const [allowed] = await db.insert(invitations).values({ email: access.email })
      .onConflictDoUpdate({
        target: invitations.email,
        set: { requestedAt: new Date() },
        setWhere: sql`${invitations.requestedAt} < now() - interval '5 minutes'`,
      }).returning()
    if (!allowed) return Response.json(inviteViewer ? { error: 'An invitation was recently requested. Wait five minutes before sending another.' } : { message }, { status: inviteViewer ? 429 : 200, headers })
    const existing = (await admin.listUsers({ perPage: 1000 })).find((user) => user.email?.toLowerCase() === access.email)
    if (existing?.confirmedAt) return Response.json({ message: inviteViewer ? 'View-only access is ready. This person already has an account and can sign in with their existing password.' : message }, { headers })
    const response = await fetch(`${identity.url.replace(/\/$/, '')}/invite`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${identity.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: access.email, data: { full_name: access.name } }),
    })
    if (!response.ok) return Response.json({ error: inviteViewer ? 'View-only access was saved, but the invitation email could not be sent. Retry from the member list in five minutes.' : 'The invitation could not be sent. Please try again in five minutes or use password recovery for an existing account.' }, { status: 502, headers })
    return Response.json({ message: inviteViewer ? 'Invitation sent with view-only access. The recipient can choose their own password using the emailed link.' : message }, { headers })
  } catch (error) {
    const status = typeof error === 'object' && error && 'status' in error && error.status === 403 ? 403 : 503
    return Response.json({ error: status === 403 ? 'This request is not allowed.' : 'Access setup is temporarily unavailable. Please try again.' }, { status, headers })
  }
}

export const config: Config = { path: '/api/access' }
