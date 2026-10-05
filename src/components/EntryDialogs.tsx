import { useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Check, Trash2 } from 'lucide-react'
import { Dialog } from './Dialog'
import { localDate, parseMoney, money, formatDate } from '../lib/ledger'
import type { Account, Transaction, TransactionType } from '../lib/ledger'

export type SaveEntry = (method: 'POST' | 'PATCH' | 'DELETE', body: Record<string, unknown>) => Promise<void>

export function AccountDialog({ account, onClose, onSave, onDelete }: { account?: Account; onClose: () => void; onSave: SaveEntry; onDelete: (account: Account) => void }) {
  const [name, setName] = useState(account?.name ?? '')
  const [number, setNumber] = useState(account?.accountNumber ?? '')
  const [balance, setBalance] = useState(account ? (account.openingCents / 100).toFixed(2) : '0.00')
  const [color, setColor] = useState(account?.color ?? 'green')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (parseMoney(balance, true) === null) { setError('Enter a valid opening balance with no more than two decimal places.'); return }
    setBusy(true)
    try {
      await onSave(account ? 'PATCH' : 'POST', { entity: 'account', id: account?.id, updatedAt: account?.updatedAt, name, accountNumber: number, openingBalance: balance, color })
      onClose()
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'The account could not be saved.') }
    finally { setBusy(false) }
  }

  return <Dialog title={account ? 'Edit account' : 'A place for your entries.'} eyebrow={account ? 'YOUR ACCOUNTS' : 'NEW ACCOUNT'} onClose={onClose} busy={busy}>
    <p className="dialog-description">{account ? 'Update the details of your account. Balances are recalculated automatically.' : 'Add your account details and a starting balance. Everything stays in your private workspace.'}</p>
    <form onSubmit={submit} className="entry-form">
      <label>Account name<input autoComplete="off" required maxLength={80} placeholder="Give this account a name" value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label>Account number<input autoComplete="off" required minLength={3} maxLength={34} pattern="[a-zA-Z0-9 \-]{3,34}" placeholder="Enter your account number" value={number} onChange={(event) => setNumber(event.target.value)} /><small>Shown with only the last four characters by default.</small></label>
      <label>Opening balance<span className="currency-input"><span>$</span><input inputMode="decimal" required value={balance} onChange={(event) => setBalance(event.target.value)} /></span><small>The balance before the transactions you record here.</small></label>
      <fieldset className="color-field"><legend>Account color</legend><div className="color-options">{['green', 'blue', 'sand', 'purple'].map((option) => <button type="button" key={option} aria-label={`${option} account color`} aria-pressed={color === option} className={`color-option color-${option} ${color === option ? 'selected' : ''}`} onClick={() => setColor(option)}>{color === option && <Check size={18} />}</button>)}</div></fieldset>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="dialog-actions">{account && <button type="button" className="button button-danger-quiet" disabled={busy} onClick={() => onDelete(account)}><Trash2 size={16} /> Delete</button>}<button type="button" className="button button-secondary" disabled={busy} onClick={onClose}>Cancel</button><button type="submit" className="button button-primary" disabled={busy}>{busy ? 'Saving…' : account ? 'Save changes' : 'Add account'}</button></div>
    </form>
  </Dialog>
}

export function TransactionDialog({ transaction, accounts, onClose, onSave, onDelete, readOnly = false }: { transaction?: Transaction; accounts: Account[]; onClose: () => void; onSave: SaveEntry; onDelete: (transaction: Transaction) => void; readOnly?: boolean }) {
  const [type, setType] = useState<TransactionType>(transaction?.type ?? 'deposit')
  const [description, setDescription] = useState(transaction?.description ?? '')
  const [accountId, setAccountId] = useState(transaction?.accountId ?? accounts[0]?.id ?? '')
  const [destinationId, setDestinationId] = useState(transaction?.destinationId ?? '')
  const [date, setDate] = useState(transaction?.date ?? localDate())
  const [amount, setAmount] = useState(transaction ? (transaction.amountCents / 100).toFixed(2) : '')
  const [notes, setNotes] = useState(transaction?.notes ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (readOnly) return
    setError('')
    const cents = parseMoney(amount)
    if (!cents || cents <= 0) { setError('Enter a positive amount with no more than two decimal places.'); return }
    if (type === 'transfer' && (!destinationId || accountId === destinationId)) { setError('Choose a different destination account for this transfer.'); return }
    setBusy(true)
    try {
      await onSave(transaction ? 'PATCH' : 'POST', { entity: 'transaction', id: transaction?.id, updatedAt: transaction?.updatedAt, type, description, accountId, destinationId: type === 'transfer' ? destinationId : null, date, amount, notes })
      onClose()
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'The transaction could not be saved.') }
    finally { setBusy(false) }
  }

  if (readOnly && transaction) return <Dialog title={transaction.description} eyebrow="TRANSACTION DETAILS" onClose={onClose}>
    <div className={`detail-amount ${transaction.type === 'deposit' ? 'positive' : ''}`}>{money(transaction.amountCents)}</div>
    <dl className="detail-list"><div><dt>Type</dt><dd className="capitalize">{transaction.type}</dd></div><div><dt>Date</dt><dd>{formatDate(transaction.date, true)}</dd></div><div><dt>Account</dt><dd>{accounts.find((account) => account.id === transaction.accountId)?.name}</dd></div>{transaction.destinationId && <div><dt>To account</dt><dd>{accounts.find((account) => account.id === transaction.destinationId)?.name}</dd></div>}<div><dt>Notes</dt><dd>{transaction.notes || 'No notes added.'}</dd></div></dl>
    <p className="readonly-note">You have view-only access to this entry.</p><button type="button" className="button button-primary full-width" onClick={onClose}>Done</button>
  </Dialog>

  return <Dialog title={transaction ? 'Edit transaction' : 'Every detail, accounted for.'} eyebrow={transaction ? 'YOUR TRANSACTIONS' : 'NEW TRANSACTION'} onClose={onClose} busy={busy}>
    <p className="dialog-description">{transaction ? 'Make a correction. Your balances update with your changes.' : 'Record a deposit, withdrawal, or transfer in a few simple steps.'}</p>
    <form onSubmit={submit} className="entry-form">
      <div className="type-picker">{([{ type: 'deposit', label: 'Deposit', Icon: ArrowDownLeft }, { type: 'withdrawal', label: 'Withdrawal', Icon: ArrowUpRight }, { type: 'transfer', label: 'Transfer', Icon: ArrowLeftRight }] as const).map((option) => <button key={option.type} type="button" className={type === option.type ? 'selected' : ''} aria-pressed={type === option.type} onClick={() => setType(option.type)}><option.Icon size={19} />{option.label}</button>)}</div>
      <label>Description<input autoComplete="off" required maxLength={160} placeholder="What is this entry for?" value={description} onChange={(event) => setDescription(event.target.value)} /></label>
      <div className="form-grid"><label>Amount<span className="currency-input"><span>$</span><input inputMode="decimal" autoComplete="off" required placeholder="0.00" value={amount} onChange={(event) => setAmount(event.target.value)} /></span></label><label>Transaction date<input type="date" required min="1900-01-01" max="2100-12-31" value={date} onChange={(event) => setDate(event.target.value)} /></label></div>
      <label>{type === 'transfer' ? 'From account' : 'Account'}<select value={accountId} required onChange={(event) => { setAccountId(event.target.value); if (event.target.value === destinationId) setDestinationId('') }}>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {account.accountNumber.slice(-4)}</option>)}</select></label>
      {type === 'transfer' && <label>To account<select value={destinationId} required onChange={(event) => setDestinationId(event.target.value)}><option value="">Choose a destination account</option>{accounts.filter((account) => account.id !== accountId).map((account) => <option key={account.id} value={account.id}>{account.name} · {account.accountNumber.slice(-4)}</option>)}</select><small>{accounts.length < 2 ? 'Add a second account before recording a transfer.' : 'A transfer updates both accounts without changing your total balance.'}</small></label>}
      <label>Notes <span className="label-optional">optional</span><textarea maxLength={1000} rows={3} placeholder="Anything else you want to remember…" value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="dialog-actions">{transaction && <button type="button" className="button button-danger-quiet" disabled={busy} onClick={() => onDelete(transaction)}><Trash2 size={16} /> Delete</button>}<button className="button button-secondary" type="button" disabled={busy} onClick={onClose}>Cancel</button><button className="button button-primary" type="submit" disabled={busy || (type === 'transfer' && accounts.length < 2)}>{busy ? 'Saving…' : transaction ? 'Save changes' : 'Add transaction'}</button></div>
    </form>
  </Dialog>
}

export function DeleteDialog({ entry, onClose, onSave }: { entry: Account | Transaction; onClose: () => void; onSave: SaveEntry }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const isAccount = 'accountNumber' in entry
  async function remove() {
    setBusy(true)
    try { await onSave('DELETE', { entity: isAccount ? 'account' : 'transaction', id: entry.id, updatedAt: entry.updatedAt }); onClose() }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'This entry could not be deleted.') }
    finally { setBusy(false) }
  }
  return <Dialog title={`Delete this ${isAccount ? 'account' : 'transaction'}?`} eyebrow="CONFIRM DELETION" onClose={onClose} busy={busy}>
    <p className="dialog-description">“{isAccount ? entry.name : entry.description}” is permanently removed from REGIONS. {isAccount ? 'Accounts with transactions cannot be deleted.' : 'The account balance is recalculated automatically.'} This cannot be undone.</p>
    {error && <p className="form-error" role="alert">{error}</p>}<div className="dialog-actions"><button type="button" className="button button-secondary" disabled={busy} onClick={onClose}>Keep entry</button><button type="button" className="button button-danger" disabled={busy} onClick={remove}>{busy ? 'Deleting…' : 'Delete entry'}</button></div>
  </Dialog>
}
