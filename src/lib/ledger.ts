export type Role = 'editor' | 'viewer'
export type TransactionType = 'deposit' | 'withdrawal' | 'transfer'
export type Page = 'Overview' | 'Transactions' | 'Accounts' | 'Activity' | 'Access'

export interface Account {
  id: string
  name: string
  accountNumber: string
  openingCents: number
  color: string
  createdAt: string
  updatedAt: string
}

export interface Transaction {
  id: string
  accountId: string
  destinationId: string | null
  type: TransactionType
  date: string
  description: string
  amountCents: number
  notes: string
  createdAt: string
  updatedAt: string
}

export interface Activity {
  id: string
  actorName: string
  action: string
  description: string
  createdAt: string
}

export interface LedgerData {
  user: { name: string; role: Role }
  accounts: Account[]
  transactions: Transaction[]
  activity: Activity[]
  access: { email: string; name: string; role: Role }[]
}

export const money = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)

export function parseMoney(value: string, signed = false): number | null {
  const cleaned = value.replace(/,/g, '').trim()
  if (!(signed ? /^-?\d+(\.\d{1,2})?$/ : /^\d+(\.\d{1,2})?$/).test(cleaned)) return null
  const negative = cleaned.startsWith('-')
  const [whole, fraction = ''] = cleaned.replace('-', '').split('.')
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  return Number.isSafeInteger(cents) && cents <= 100_000_000_000 ? (negative ? -cents : cents) : null
}

export function accountBalance(account: Account, transactions: Transaction[]) {
  return transactions.reduce((balance, transaction) => {
    if (transaction.accountId === account.id) return balance + (transaction.type === 'deposit' ? transaction.amountCents : -transaction.amountCents)
    if (transaction.destinationId === account.id) return balance + transaction.amountCents
    return balance
  }, account.openingCents)
}

export function localDate() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function formatDate(value: string, year = false) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(year ? { year: 'numeric' } : {}) })
}

export function csvCell(value: string | number) {
  const text = String(value)
  return `"${(/^\s*[=+\-@]|^[\t\r]/.test(text) ? "'" : '') + text.replace(/"/g, '""')}"`
}
