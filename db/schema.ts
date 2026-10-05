import { sql } from 'drizzle-orm'
import { pgTable, pgEnum, uuid, text, bigint, date, timestamp, check, index } from 'drizzle-orm/pg-core'

export const transactionKind = pgEnum('transaction_kind', ['deposit', 'withdrawal', 'transfer'])

export const accounts = pgTable('ledger_accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  accountNumber: text('account_number').notNull().unique(),
  openingCents: bigint('opening_cents', { mode: 'number' }).notNull().default(0),
  color: text('color').notNull().default('green'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
})

export const transactions = pgTable('ledger_transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'restrict' }),
  destinationId: uuid('destination_id').references(() => accounts.id, { onDelete: 'restrict' }),
  type: transactionKind('type').notNull(),
  date: date('date', { mode: 'string' }).notNull(),
  description: text('description').notNull(),
  amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
  notes: text('notes').notNull().default(''),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
}, (table) => [
  check('positive_amount', sql`${table.amountCents} > 0`),
  check('valid_transfer', sql`(${table.type} = 'transfer' AND ${table.destinationId} IS NOT NULL AND ${table.destinationId} <> ${table.accountId}) OR (${table.type} <> 'transfer' AND ${table.destinationId} IS NULL)`),
  index('transactions_date_idx').on(table.date),
  index('transactions_account_idx').on(table.accountId),
])

export const activity = pgTable('ledger_activity', {
  id: uuid('id').defaultRandom().primaryKey(),
  actorId: text('actor_id').notNull(),
  actorName: text('actor_name').notNull(),
  action: text('action').notNull(),
  entityId: uuid('entity_id').notNull(),
  description: text('description').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const invitations = pgTable('ledger_invitations', {
  email: text('email').primaryKey(),
  requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
})

export const viewerMembers = pgTable('regions_viewer_members', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  invitedBy: text('invited_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
