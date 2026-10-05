import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getUser, handleAuthCallback, logout, onAuthChange } from '@netlify/identity'
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, ArrowRight, ArrowUpDown, Bell, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Download, Ellipsis, Eye, EyeOff, FileText, FolderClosed, History, LayoutDashboard, Leaf, ListFilter, LockKeyhole, LogIn, LogOut, Menu, Plus, RefreshCw, Search, ShieldCheck, Users, Wallet, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { accountBalance, csvCell, formatDate, localDate, money } from '../lib/ledger'
import type { Account, LedgerData, Page, Transaction, TransactionType } from '../lib/ledger'
import { AuthDialog } from './AuthDialog'
import type { AuthMode } from './AuthDialog'
import { AccountDialog, DeleteDialog, TransactionDialog } from './EntryDialogs'
import type { SaveEntry } from './EntryDialogs'
import { Dialog } from './Dialog'
import { BalanceChart } from './BalanceChart'
import { ViewerInviteForm } from './ViewerInviteForm'

type EntryModal = { kind: 'account'; account?: Account } | { kind: 'transaction'; transaction?: Transaction } | { kind: 'delete'; entry: Account | Transaction }
type Period = 'all' | 'month' | 'last-month' | 'year'

function Brand({ compact = false }: { compact?: boolean }) {
  return <div className={`brand ${compact ? 'brand-compact' : ''}`} aria-label="REGIONS"><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span><div><span className="brand-name"><strong>REGIONS</strong></span></div></div>
}

function EmptyState({ icon: Icon = FileText, title, text, action, onAction }: { icon?: LucideIcon; title: string; text: string; action?: string; onAction?: () => void }) {
  return <div className="empty-state"><span className="empty-icon"><Icon size={26} strokeWidth={1.5} /></span><h3>{title}</h3><p>{text}</p>{action && <button type="button" className="button button-secondary" onClick={onAction}>{action}<ArrowRight size={15} /></button>}</div>
}

function AccountCard({ account, transactions, editor, onEdit, mini = false, onSelect }: { account: Account; transactions: Transaction[]; editor: boolean; onEdit: () => void; mini?: boolean; onSelect?: () => void }) {
  const [reveal, setReveal] = useState(false)
  const balance = accountBalance(account, transactions)
  if (mini) return <button type="button" className="mini-account" onClick={onSelect}><span className={`account-icon color-${account.color}`}><Wallet size={19} strokeWidth={1.7} /></span><span className="mini-account-name"><strong>{account.name}</strong><span>•••• {account.accountNumber.slice(-4)}</span></span><span className="mini-account-balance">{money(balance)}<ChevronRight size={14} /></span></button>
  return <article className={`account-card account-${account.color}`}><div className="account-card-top"><span className={`account-icon color-${account.color}`}><Wallet size={21} strokeWidth={1.7} /></span>{editor && <button type="button" className="icon-button" aria-label={`Edit ${account.name}`} onClick={onEdit}><Ellipsis size={20} /></button>}</div><h3>{account.name}</h3><div className="account-number"><span>{reveal ? account.accountNumber : `•••• ${account.accountNumber.slice(-4)}`}</span><button type="button" aria-label={reveal ? 'Hide account number' : 'Show account number'} onClick={() => setReveal(!reveal)}>{reveal ? <EyeOff size={14} /> : <Eye size={14} />}</button></div><div className="account-card-balance"><span>Current balance</span><strong>{money(balance)}</strong></div><div className="account-card-bottom"><span>Opening {money(account.openingCents)}</span><button className="text-button" type="button" onClick={onSelect}>View entries<ArrowRight size={14} /></button></div></article>
}

function matchesPeriod(date: string, period: Period) {
  const now = new Date()
  const last = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const lastMonth = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}`
  return period === 'all' || (period === 'month' && date.startsWith(currentMonth)) || (period === 'last-month' && date.startsWith(lastMonth)) || (period === 'year' && date.startsWith(String(now.getFullYear())))
}

export function LedgerApp() {
  const [page, setPage] = useState<Page>('Overview')
  const [data, setData] = useState<LedgerData | null>(null)
  const [loading, setLoading] = useState(true)
  const [hasSession, setHasSession] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [authModal, setAuthModal] = useState<AuthMode | null>(null)
  const [entryModal, setEntryModal] = useState<EntryModal | null>(null)
  const [help, setHelp] = useState(false)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [period, setPeriod] = useState<Period>('all')
  const [accountFilter, setAccountFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [sortAscending, setSortAscending] = useState(false)
  const [tablePage, setTablePage] = useState(1)
  const [inviteBusy, setInviteBusy] = useState<string | null>(null)
  const requestVersion = useRef(0)
  const editor = data?.user.role === 'editor'
  const accounts = data?.accounts ?? []
  const transactions = data?.transactions ?? []

  const clearSession = useCallback(() => {
    requestVersion.current += 1
    setData(null)
    setHasSession(false)
    setEntryModal(null)
    setAccountFilter('all')
    setQuery('')
    setTypeFilter('all')
    setPage('Overview')
    setError('')
  }, [])

  const loadLedger = useCallback(async () => {
    const current = ++requestVersion.current
    setLoading(true)
    setError('')
    try {
      const user = await getUser()
      if (current !== requestVersion.current) return
      if (!user?.confirmedAt) { clearSession(); setLoading(false); return }
      setHasSession(true)
      const response = await fetch('/api/ledger', { credentials: 'same-origin', cache: 'no-store' })
      const result = await response.json()
      if (current !== requestVersion.current) return
      if (response.status === 401 || response.status === 403) {
        clearSession()
        setError(result.error ?? 'Please sign in again.')
        setLoading(false)
        return
      }
      if (!response.ok) throw new Error(result.error ?? 'REGIONS could not be opened.')
      setData(result)
      setAccountFilter((value) => value === 'all' || result.accounts.some((account: Account) => account.id === value) ? value : 'all')
      if (result.user.role !== 'editor') setPage((value) => value === 'Access' ? 'Overview' : value)
    } catch (failure) {
      if (current === requestVersion.current) setError(failure instanceof Error ? failure.message : 'REGIONS could not be opened. Please try again.')
    } finally {
      if (current === requestVersion.current) setLoading(false)
    }
  }, [clearSession])

  useEffect(() => {
    let active = true
    const unsubscribe = onAuthChange((event) => {
      if (!active) return
      if (event === 'logout') { clearSession(); setLoading(false) }
      if (event === 'login' || event === 'user_updated') void loadLedger()
    })
    async function initialize() {
      try {
        const callback = await handleAuthCallback()
        if (!active) return
        if (callback?.type === 'invite' || callback?.type === 'recovery') {
          clearSession()
          setAuthModal({ kind: callback.type, token: callback.token })
          setLoading(false)
          return
        }
        if (callback?.type === 'confirmation') setToast('Your email is confirmed. Welcome to REGIONS.')
        await loadLedger()
      } catch {
        if (active) { setError('This access link is invalid or expired. Request a new invitation or password reset.'); setAuthModal({ kind: 'login' }); setLoading(false) }
      }
    }
    void initialize()
    return () => { active = false; unsubscribe(); requestVersion.current += 1 }
  }, [clearSession, loadLedger])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(''), 5500)
    return () => window.clearTimeout(timeout)
  }, [toast])

  useEffect(() => { setTablePage(1) }, [query, accountFilter, typeFilter, period, page])

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase()
    return transactions.filter((transaction) => {
      if (accountFilter !== 'all' && transaction.accountId !== accountFilter && transaction.destinationId !== accountFilter) return false
      if (typeFilter !== 'all' && transaction.type !== typeFilter) return false
      if (!matchesPeriod(transaction.date, period)) return false
      const account = accounts.find((item) => item.id === transaction.accountId)
      const destination = accounts.find((item) => item.id === transaction.destinationId)
      return !search || `${transaction.description} ${transaction.notes} ${transaction.date} ${transaction.type} ${account?.name ?? ''} ${account?.accountNumber ?? ''} ${destination?.name ?? ''} ${(transaction.amountCents / 100).toFixed(2)}`.toLowerCase().includes(search)
    }).sort((first, second) => (sortAscending ? 1 : -1) * (first.date.localeCompare(second.date) || first.createdAt.localeCompare(second.createdAt) || first.id.localeCompare(second.id)))
  }, [transactions, accounts, query, accountFilter, typeFilter, period, sortAscending])

  const runningBalances = useMemo(() => {
    const balances = new Map(accounts.map((account) => [account.id, account.openingCents]))
    const results = new Map<string, { source: number; destination?: number }>()
    for (const transaction of [...transactions].sort((first, second) => first.date.localeCompare(second.date) || first.createdAt.localeCompare(second.createdAt) || first.id.localeCompare(second.id))) {
      const source = (balances.get(transaction.accountId) ?? 0) + (transaction.type === 'deposit' ? transaction.amountCents : -transaction.amountCents)
      balances.set(transaction.accountId, source)
      let destination: number | undefined
      if (transaction.destinationId) {
        destination = (balances.get(transaction.destinationId) ?? 0) + transaction.amountCents
        balances.set(transaction.destinationId, destination)
      }
      results.set(transaction.id, { source, destination })
    }
    return results
  }, [accounts, transactions])

  const flowTransactions = useMemo(() => transactions.filter((transaction) => matchesPeriod(transaction.date, period) && (accountFilter === 'all' || transaction.accountId === accountFilter || transaction.destinationId === accountFilter)), [transactions, period, accountFilter])
  const totalBalance = accounts.filter((account) => accountFilter === 'all' || account.id === accountFilter).reduce((total, account) => total + accountBalance(account, transactions), 0)
  const totalDeposits = flowTransactions.filter((transaction) => transaction.type === 'deposit').reduce((total, transaction) => total + transaction.amountCents, 0)
  const totalWithdrawals = flowTransactions.filter((transaction) => transaction.type === 'withdrawal').reduce((total, transaction) => total + transaction.amountCents, 0)
  const totalTransfers = flowTransactions.filter((transaction) => transaction.type === 'transfer')
  const totalPages = Math.max(1, Math.ceil(filtered.length / 8))
  const currentTablePage = Math.min(tablePage, totalPages)
  const tableRows = page === 'Overview' ? filtered.slice(0, 5) : filtered.slice((currentTablePage - 1) * 8, currentTablePage * 8)

  function navigate(next: Page) {
    setPage(next)
    setMobileMenu(false)
    setQuery('')
    setTypeFilter('all')
  }

  function addAccount() {
    if (!data) { setAuthModal({ kind: 'login' }); return }
    if (editor) setEntryModal({ kind: 'account' })
  }

  function addTransaction() {
    if (!data) { setAuthModal({ kind: 'login' }); return }
    if (!editor) return
    if (!accounts.length) { setToast('Add your first account, then record your transactions.'); setEntryModal({ kind: 'account' }); return }
    setEntryModal({ kind: 'transaction' })
  }

  const saveEntry: SaveEntry = async (method, body) => {
    const user = await getUser()
    if (!user) { clearSession(); setAuthModal({ kind: 'login' }); throw new Error('Your session has expired. Please sign in again.') }
    const response = await fetch('/api/ledger', { method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error ?? 'This change could not be saved.')
    await loadLedger()
    setToast(method === 'DELETE' ? 'Entry deleted. Your balances are up to date.' : method === 'PATCH' ? 'Changes saved. Everything is up to date.' : `${body.entity === 'account' ? 'Account' : 'Transaction'} added to REGIONS.`)
  }

  async function signOut() {
    clearSession()
    setLoading(false)
    try { await logout(); setToast('You’re signed out of your workspace.') }
    catch { setError('Sign-out could not be completed. Please try again before leaving this device.'); setHasSession(true) }
  }

  async function invite(email: string) {
    setInviteBusy(email)
    try {
      const response = await fetch('/api/access', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'The invitation could not be requested.')
      setToast(result.message)
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'The invitation could not be requested.') }
    finally { setInviteBusy(null) }
  }

  function exportTransactions() {
    if (!data) { setAuthModal({ kind: 'login' }); return }
    if (!filtered.length) { setToast('There are no transactions in this view to export.'); return }
    const rows: (string | number)[][] = [['Date', 'Description', 'Type', 'Account', 'Account number', 'Destination account', 'Amount USD', 'Account balance USD', 'Notes']]
    for (const transaction of filtered) {
      const account = accounts.find((item) => item.id === transaction.accountId)
      const destination = accounts.find((item) => item.id === transaction.destinationId)
      rows.push([transaction.date, transaction.description, transaction.type, account?.name ?? '', account?.accountNumber ?? '', destination?.name ?? '', (transaction.amountCents / 100).toFixed(2), ((runningBalances.get(transaction.id)?.source ?? 0) / 100).toFixed(2), transaction.notes])
    }
    const blob = new Blob(['\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `my-regions-REGIONS-${localDate()}.csv`
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    setToast('Your transaction export is ready.')
  }

  function clearFilters() { setQuery(''); setTypeFilter('all'); setAccountFilter('all'); setPeriod('all') }

  function transactionsPanel() {
    const anyFilters = Boolean(query || typeFilter !== 'all' || accountFilter !== 'all' || period !== 'all')
    return <section className="panel transactions-panel" aria-labelledby="transactions-heading">
      <div className="panel-heading transactions-heading"><div><h2 id="transactions-heading">{page === 'Overview' ? 'Recent transactions' : 'All transactions'}<span className="count-badge">{filtered.length}</span></h2><p>{page === 'Overview' ? 'The latest entries in REGIONS.' : 'Every entry, with all the details that matter.'}</p></div>{page === 'Overview' && <button type="button" className="text-button" onClick={() => navigate('Transactions')}>View all<ArrowRight size={15} /></button>}</div>
      <div className="table-toolbar"><label className="search-input"><Search size={17} /><input type="search" aria-label="Search transactions" placeholder="Search transactions…" value={query} onChange={(event) => setQuery(event.target.value)} /></label><div className="table-filters"><label className="filter-select"><ListFilter size={15} /><select aria-label="Filter transaction type" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="all">All types</option><option value="deposit">Deposits</option><option value="withdrawal">Withdrawals</option><option value="transfer">Transfers</option></select></label><label className="filter-select"><Wallet size={15} /><select aria-label="Filter account" value={accountFilter} onChange={(event) => setAccountFilter(event.target.value)}><option value="all">All accounts</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label></div></div>
      <div className="table-scroll"><table><thead><tr><th>Description</th><th><button type="button" className="sort-button" onClick={() => setSortAscending(!sortAscending)} aria-label={`Sort date ${sortAscending ? 'newest first' : 'oldest first'}`}>Date<ArrowUpDown size={12} /></button></th><th>Account</th><th>Type</th><th className="align-right">Amount</th><th className="align-right">Account balance</th><th><span className="sr-only">Entry details</span></th></tr></thead><tbody>
        {loading && !data ? Array.from({ length: 3 }, (_, index) => <tr className="skeleton-row" key={index}>{Array.from({ length: 7 }, (_, cell) => <td key={cell}><span className="skeleton" /></td>)}</tr>) : tableRows.map((transaction) => {
          const account = accounts.find((item) => item.id === transaction.accountId)
          const destination = accounts.find((item) => item.id === transaction.destinationId)
          const incomingTransfer = transaction.destinationId === accountFilter
          const Icon = transaction.type === 'deposit' ? ArrowDownLeft : transaction.type === 'withdrawal' ? ArrowUpRight : ArrowLeftRight
          const balance = incomingTransfer ? runningBalances.get(transaction.id)?.destination : runningBalances.get(transaction.id)?.source
          return <tr key={transaction.id}><td><div className="transaction-description"><span className={`transaction-icon type-${transaction.type}`}><Icon size={17} strokeWidth={1.8} /></span><div><button type="button" className="entry-link" onClick={() => setEntryModal({ kind: 'transaction', transaction })}>{transaction.description}</button>{transaction.type === 'transfer' ? <small>{account?.name} → {destination?.name}</small> : <small>{transaction.notes || 'Recorded entry'}</small>}</div></div></td><td className="nowrap">{formatDate(transaction.date, true)}</td><td><span className="table-account-name">{incomingTransfer ? destination?.name : account?.name}</span><small className="table-account-number">•••• {(incomingTransfer ? destination : account)?.accountNumber.slice(-4)}</small></td><td><span className={`type-badge type-${transaction.type}`}><i />{transaction.type}</span></td><td className={`align-right amount ${transaction.type === 'deposit' || incomingTransfer ? 'positive' : ''}`}>{transaction.type === 'deposit' || incomingTransfer ? '+' : transaction.type === 'withdrawal' || accountFilter !== 'all' ? '−' : ''}{money(transaction.amountCents)}</td><td className="align-right table-balance">{money(balance ?? 0)}</td><td><button type="button" className="icon-button entry-more" aria-label={`${editor ? 'Edit' : 'View'} ${transaction.description}`} onClick={() => setEntryModal({ kind: 'transaction', transaction })}>{editor ? <Ellipsis size={18} /> : <Eye size={16} />}</button></td></tr>
        })}
      </tbody></table></div>
      {!loading && !tableRows.length && <EmptyState icon={!data ? LockKeyhole : anyFilters ? Search : FileText} title={!data ? 'Your entries stay with you.' : anyFilters ? 'No matching entries.' : 'A fresh page, ready for you.'} text={!data ? 'Sign in to view your transactions. Only approved accounts can open this workspace.' : anyFilters ? 'Try a different search or clear your filters to see more entries.' : editor ? 'Add your first transaction. We’ll take care of keeping the balances in order.' : 'Entries appear here as your team records them.'} action={!data ? 'Sign in to REGIONS' : anyFilters ? 'Clear filters' : editor ? 'Add a transaction' : undefined} onAction={!data ? () => setAuthModal({ kind: 'login' }) : anyFilters ? clearFilters : addTransaction} />}
      <div className="table-footer"><span>{filtered.length ? `${page === 'Overview' ? 1 : (currentTablePage - 1) * 8 + 1}–${page === 'Overview' ? Math.min(5, filtered.length) : Math.min(currentTablePage * 8, filtered.length)} of ${filtered.length} entries` : 'No entries yet'}<span className="footer-dot">·</span> USD</span>{page === 'Transactions' && filtered.length > 0 ? <div className="pagination"><button type="button" className="icon-button" disabled={currentTablePage === 1} aria-label="Previous page" onClick={() => setTablePage(currentTablePage - 1)}><ChevronLeft size={16} /></button><span>{currentTablePage} / {totalPages}</span><button type="button" className="icon-button" disabled={currentTablePage >= totalPages} aria-label="Next page" onClick={() => setTablePage(currentTablePage + 1)}><ChevronRight size={16} /></button></div> : <span className="footer-security"><ShieldCheck size={13} />{data?.user.role === 'viewer' ? 'View-only access' : 'Private & organized'}</span>}</div>
    </section>
  }

  const navItems: { label: Page; Icon: LucideIcon; section?: string }[] = [
    { label: 'Overview', Icon: LayoutDashboard }, { label: 'Transactions', Icon: ArrowLeftRight }, { label: 'Accounts', Icon: Wallet }, { label: 'Activity', Icon: History },
    ...(editor ? [{ label: 'Access' as const, Icon: Users, section: 'WORKSPACE' }] : []),
  ]

  return <div className="app-shell">
    {mobileMenu && <button type="button" className="sidebar-backdrop" aria-label="Close navigation" onClick={() => setMobileMenu(false)} />}
    <aside className={`sidebar ${mobileMenu ? 'sidebar-open' : ''}`}>
      <button type="button" className="brand-button" aria-label="Open REGIONS overview" onClick={() => navigate('Overview')}><Brand /></button>
      <div className="workspace-switch"><span className="workspace-avatar">M</span><div><strong>My workspace</strong><span>Personal REGIONS</span></div><LockKeyhole size={14} /></div>
      <p className="nav-label">REGIONS</p>
      <nav id="REGIONS-navigation" aria-label="Main navigation">{navItems.map(({ label, Icon, section }) => <div key={label}>{section && <p className="nav-label nav-label-secondary">{section}</p>}<button type="button" aria-current={page === label ? 'page' : undefined} className={`nav-item ${page === label ? 'nav-item-active' : ''}`} onClick={() => navigate(label)}><Icon size={19} strokeWidth={1.7} /><span>{label}</span>{label === 'Transactions' && data && transactions.length > 0 && <span className="nav-count">{transactions.length}</span>}{page === label && <span className="nav-active-dot" />}</button></div>)}</nav>
      <div className="sidebar-bottom"><div className="sidebar-note"><span className="sidebar-note-icon"><Leaf size={22} strokeWidth={1.4} /></span><h3>A little clarity.<br />A lot of peace of mind.</h3><p>Your entries, thoughtfully<br />kept in one place.</p><span className="sidebar-note-line" /></div><button type="button" className="sidebar-help" onClick={() => setHelp(true)}><CircleHelp size={17} /> A little help<ArrowUpRight size={14} /></button><div className="sidebar-profile"><span className="profile-avatar">{data ? data.user.name.split(' ').map((part) => part[0]).slice(0, 2).join('') : <LockKeyhole size={17} />}</span><div><strong>{data ? data.user.name : hasSession ? 'Your workspace' : 'Private workspace'}</strong><span>{data ? editor ? 'Team · Editing access' : 'View-only access' : 'Sign in to get started'}</span></div><button type="button" className="profile-action" aria-label={hasSession ? 'Sign out' : 'Sign in'} onClick={hasSession ? signOut : () => setAuthModal({ kind: 'login' })}>{hasSession ? <LogOut size={17} /> : <LogIn size={17} />}</button></div></div>
    </aside>
    <div className="main-shell">
      <header className="topbar">
        <div className="topbar-left"><button type="button" className="icon-button mobile-menu" aria-label="Open navigation" aria-expanded={mobileMenu} aria-controls="REGIONS-navigation" onClick={() => setMobileMenu(true)}><Menu size={21} /></button><span className="breadcrumb">My workspace<span>/</span><strong>{page}</strong></span></div>
        <div className="topbar-actions">
          <span className="private-indicator"><span /><LockKeyhole size={12} />Private workspace</span><span className="topbar-divider" />
          {hasSession && <button type="button" className="icon-button" aria-label="Refresh REGIONS" disabled={loading} onClick={() => void loadLedger()}><RefreshCw size={17} className={loading ? 'spinning' : ''} /></button>}
          <button type="button" className="icon-button" aria-label="View activity" onClick={() => navigate('Activity')}><Bell size={19} strokeWidth={1.6} />{data?.activity.length ? <span className="notification-dot" /> : null}</button>
          <button type="button" className="topbar-avatar" aria-label={hasSession ? 'View access information' : 'Sign in'} onClick={() => hasSession ? setHelp(true) : setAuthModal({ kind: 'login' })}>{data ? data.user.name[0] : 'M'}</button>
        </div>
      </header>
      <main>
        <div className="page-heading"><div><p className="eyebrow">A LITTLE MORE ORGANIZED</p><h1>{page === 'Overview' ? 'REGIONS, at a glance.' : page === 'Transactions' ? 'Every entry. In one place.' : page === 'Accounts' ? 'A place for everything.' : page === 'Activity' ? 'A little history.' : 'Your circle, your control.'}</h1><p className="page-description">{page === 'Overview' ? 'A clearer picture of what comes in, what goes out, and what’s yours.' : page === 'Transactions' ? 'Keep the details together. Find exactly what you’re looking for.' : page === 'Accounts' ? 'See your accounts and the balances behind them.' : page === 'Activity' ? 'A record of the changes that keep REGIONS up to date.' : 'Keep your workspace private, with the right access for each person.'}</p></div><div className="page-actions">{(page === 'Overview' || page === 'Transactions') && <button type="button" className="button button-secondary export-button" onClick={exportTransactions}><Download size={16} />Export</button>}{(!data || editor) && page !== 'Access' && <button type="button" className="button button-primary" onClick={page === 'Accounts' ? addAccount : addTransaction}><Plus size={18} />{page === 'Accounts' ? 'Add account' : 'Add transaction'}</button>}{data && !editor && <span className="viewer-pill"><Eye size={16} />View-only access</span>}</div></div>
        {error && <div className="error-banner" role="alert"><div><CircleHelp size={18} /><span>{error}</span></div><button type="button" className="text-button" onClick={() => void loadLedger()}><RefreshCw size={14} />Try again</button></div>}
        {data?.user.role === 'viewer' && <div className="viewer-banner"><Eye size={16} /><span>You’re viewing REGIONS. Entries and balances stay just as the team records them.</span></div>}
        {(page === 'Overview' || page === 'Transactions') && <>
          <div className="section-intro"><div><span className="section-dot" /><span>{page === 'Overview' ? 'Your financial snapshot' : 'Transaction summary'}</span>{accountFilter !== 'all' && <button type="button" className="account-filter-chip" onClick={() => setAccountFilter('all')}>{accounts.find((account) => account.id === accountFilter)?.name}<X size={12} /></button>}</div><label className="period-select"><span className="sr-only">Transaction period</span><select value={period} onChange={(event) => setPeriod(event.target.value as Period)}><option value="all">All time</option><option value="month">This month</option><option value="last-month">Last month</option><option value="year">This year</option></select><ChevronDown size={14} /></label></div>
          <div className="stats-grid">
            <article className="stat-card stat-primary"><div className="stat-label">Total balance<span className="stat-icon"><Wallet size={18} strokeWidth={1.7} /></span></div><strong className="stat-value">{loading && !data ? <span className="skeleton" /> : data ? money(totalBalance) : '$—.——'}</strong><div className="stat-description"><span className="balance-indicator" /><span>{data ? `${accountFilter === 'all' ? accounts.length : 1} ${accounts.length === 1 || accountFilter !== 'all' ? 'account' : 'accounts'} · all recorded entries` : 'Your balances, privately kept'}</span></div><div className="stat-decoration" aria-hidden="true"><i /><i /><i /></div></article>
            <StatCard label="Total deposits" Icon={ArrowDownLeft} value={data ? money(totalDeposits) : '$—.——'} caption={`${flowTransactions.filter((transaction) => transaction.type === 'deposit').length} deposits recorded`} locked={!data} loading={loading && !data} variant="deposit" />
            <StatCard label="Total withdrawals" Icon={ArrowUpRight} value={data ? money(totalWithdrawals) : '$—.——'} caption={`${flowTransactions.filter((transaction) => transaction.type === 'withdrawal').length} withdrawals recorded`} locked={!data} loading={loading && !data} variant="withdrawal" />
            <StatCard label="Transfers" Icon={ArrowLeftRight} value={data ? money(totalTransfers.reduce((total, transaction) => total + transaction.amountCents, 0)) : '$—.——'} caption={`${totalTransfers.length} transfers between accounts`} locked={!data} loading={loading && !data} variant="transfer" />
          </div>
        </>}
        {page === 'Overview' && <>
          <div className="overview-grid">
            <section className="panel balance-panel">
              <div className="panel-heading"><div><h2>Balance over time</h2><p>A little perspective on your progress.</p></div><span className="quiet-pill">All recorded entries</span></div>
              <BalanceChart accounts={accounts} transactions={transactions} accountId={accountFilter} signedIn={Boolean(data)} canEdit={editor} onStart={addTransaction} />
              <div className="chart-bottom"><ShieldCheck size={14} /><span>Built from your entries. Updated as you go.</span><span className="chart-bottom-currency">USD</span></div>
            </section>
            <section className="panel accounts-panel">
              <div className="panel-heading"><h2>Your accounts<span className="count-badge">{accounts.length}</span></h2><button type="button" className="icon-button" aria-label="View all accounts" onClick={() => navigate('Accounts')}><ArrowUpRight size={17} /></button></div>
              {accounts.length ? <>
                <div className="mini-accounts-list">{accounts.slice(0, 3).map((account) => <AccountCard mini key={account.id} account={account} transactions={transactions} editor={editor} onEdit={() => setEntryModal({ kind: 'account', account })} onSelect={() => { setAccountFilter(account.id); navigate('Transactions') }} />)}</div>
                {accounts.length > 3 && <button className="text-button more-accounts" type="button" onClick={() => navigate('Accounts')}>View all {accounts.length} accounts<ArrowRight size={14} /></button>}
              </> : <div className="accounts-empty">
                <span className="account-stack" aria-hidden="true"><span /><span /><span><Wallet size={27} strokeWidth={1.5} /><i /><i /></span></span>
                <h3>Everything has its place.</h3><p>{data ? editor ? 'Add an account to give your entries a home.' : 'Your accounts appear as the team adds them.' : 'Your accounts and balances come together here.'}</p>
              </div>}
              {(!data || editor) && <button type="button" className="add-account-inline" onClick={addAccount}><Plus size={16} />{data ? 'Add an account' : 'Sign in to see your accounts'}</button>}
              {data && !editor && !accounts.length && <p className="readonly-note">Accounts appear when the team adds them.</p>}
            </section>
          </div>
          {transactionsPanel()}
          <div className="workspace-note"><span className="workspace-note-icon"><Leaf size={19} strokeWidth={1.5} /></span><div><strong>A little care goes a long way.</strong><span>Keep REGIONS current. Your future self will thank you.</span></div><span className="workspace-note-end">YOUR LIFE. REGIONS.</span></div>
        </>}
        {page === 'Transactions' && transactionsPanel()}
        {page === 'Access' && editor && data && <ViewerInviteForm onRefresh={loadLedger} onUnauthorized={() => { clearSession(); setError('Please sign in again with an editor account to invite viewers.') }} />}
        {page === 'Accounts' && <>{data ? <><div className="accounts-summary"><span>{accounts.length} {accounts.length === 1 ? 'account' : 'accounts'}</span><span>Total balance <strong>{money(accounts.reduce((total, account) => total + accountBalance(account, transactions), 0))}</strong></span></div><div className="accounts-grid">{accounts.map((account) => <AccountCard key={account.id} account={account} transactions={transactions} editor={editor} onEdit={() => setEntryModal({ kind: 'account', account })} onSelect={() => { setAccountFilter(account.id); navigate('Transactions') }} />)}{editor && <button type="button" className="new-account-card" onClick={addAccount}><span><Plus size={24} strokeWidth={1.4} /></span><strong>Add another account</strong><p>A new home for your entries.</p></button>}</div>{!accounts.length && !editor && <section className="panel"><EmptyState icon={Wallet} title="Room for everything." text="Your accounts appear here as the team adds them." /></section>}<p className="accounts-footnote"><ShieldCheck size={15} />Account numbers are hidden by default. Use the eye icon to reveal one.</p></> : <section className="panel"><EmptyState icon={LockKeyhole} title="Your accounts, all together." text="Sign in to view your accounts, account numbers, and up-to-date balances." action="Open REGIONS" onAction={() => setAuthModal({ kind: 'login' })} /></section>}</>}
        {page === 'Activity' && <section className="panel activity-panel"><div className="panel-heading"><div><h2>Workspace activity</h2><p>The latest 100 changes, kept in order.</p></div><button type="button" className="icon-button" aria-label="Refresh activity" onClick={() => void loadLedger()} disabled={loading}><RefreshCw size={17} className={loading ? 'spinning' : ''} /></button></div>{data?.activity.length ? <div className="activity-list">{data.activity.map((event) => <div className="activity-event" key={event.id}><span className={`activity-event-icon ${event.action.endsWith('deleted') ? 'activity-deleted' : ''}`}>{event.action.endsWith('deleted') ? <X size={17} /> : event.action.endsWith('added') ? <Plus size={17} /> : <Check size={17} />}</span><div><strong>{event.description}</strong><p><span>{event.actorName}</span> · {event.action}</p></div><time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time></div>)}</div> : <EmptyState icon={data ? History : LockKeyhole} title={data ? 'A story yet to be written.' : 'Your history stays private.'} text={data ? 'Account and transaction changes are recorded here automatically.' : 'Sign in to see your workspace’s recent changes.'} action={!data ? 'Sign in' : editor ? 'Record your first entry' : undefined} onAction={!data ? () => setAuthModal({ kind: 'login' }) : addTransaction} />}</section>}
        {page === 'Access' && editor && data && <><div className="access-explainer"><span className="empty-icon"><ShieldCheck size={24} /></span><div><h2>The right access. The right people.</h2><p>Team accounts can add and edit entries. View-only accounts can explore the REGIONS without changing anything. Each person signs in with their email and a privately chosen password.</p></div></div><section className="panel access-panel"><div className="panel-heading"><div><h2>Workspace members<span className="count-badge">{data.access.length}</span></h2><p>Approved accounts for your personal workspace.</p></div></div>{data.access.map((member) => <div className="member-row" key={member.email}><span className={`member-avatar ${member.role === 'viewer' ? 'member-viewer' : ''}`}>{member.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span><div className="member-name"><strong>{member.name}</strong><span>{member.email}</span></div><span className={`access-role role-${member.role}`}>{member.role === 'editor' ? <Users size={14} /> : <Eye size={14} />}{member.role === 'editor' ? 'Team · Can edit' : 'View only'}</span><button className="button button-secondary" type="button" disabled={inviteBusy !== null} onClick={() => void invite(member.email)}>{inviteBusy === member.email ? 'Requesting…' : 'Send invitation'}<ArrowRight size={14} /></button></div>)}</section><div className="access-bottom"><LockKeyhole size={18} /><p>No shared or published passwords. Invitation links let each person choose their password privately. Accounts without an explicitly requested editing role have view-only access.</p></div></>}
        <footer className="page-footer"><Brand compact /><span>Thoughtfully organized. Privately yours.</span><button type="button" className="text-button" onClick={() => setHelp(true)}><ShieldCheck size={13} />Access & privacy</button></footer>
      </main>
    </div>
    {toast && <div className="toast" role="status"><CheckCircle2 size={19} /><span>{toast}</span><button type="button" className="icon-button" aria-label="Dismiss notification" onClick={() => setToast('')}><X size={15} /></button></div>}
    {authModal && <AuthDialog initial={authModal} onClose={() => { if (authModal.kind === 'recovery') void signOut(); setAuthModal(null) }} onDone={(message) => { setAuthModal(null); setToast(message); void loadLedger() }} />}
    {entryModal?.kind === 'account' && editor && <AccountDialog account={entryModal.account} onClose={() => setEntryModal(null)} onSave={saveEntry} onDelete={(entry) => setEntryModal({ kind: 'delete', entry })} />}
    {entryModal?.kind === 'transaction' && data && <TransactionDialog transaction={entryModal.transaction} accounts={accounts} readOnly={!editor} onClose={() => setEntryModal(null)} onSave={saveEntry} onDelete={(entry) => setEntryModal({ kind: 'delete', entry })} />}
    {entryModal?.kind === 'delete' && editor && <DeleteDialog entry={entryModal.entry} onClose={() => setEntryModal(null)} onSave={saveEntry} />}
    {help && <Dialog title="A little help with REGIONS." eyebrow="YOUR WORKSPACE" onClose={() => setHelp(false)}><div className="help-content"><div><FolderClosed size={21} /><section><h3>Start with an account</h3><p>Add a name, account number, and opening balance. Then record your deposits, withdrawals, and transfers. Balances are calculated from your entries.</p></section></div><div><Users size={21} /><section><h3>Access that fits</h3><p>Team access can create, edit, and delete entries. View-only access can see accounts and transactions, search entries, and download exports. Permissions are enforced securely.</p></section></div><div><LockKeyhole size={21} /><section><h3>Your private sign-in</h3><p>Your username is your approved email address. Choose your own password through “Set up your access” on the sign-in screen. If you forget it, use “Forgot password.” Passwords are never displayed or shared.</p></section></div><div><Download size={21} /><section><h3>A copy when you need one</h3><p>Export downloads a CSV of the transactions in your current filtered view. Exports contain account numbers; keep these files private. Refresh your workspace to see entries made by others.</p></section></div></div><button type="button" className="button button-primary full-width" onClick={() => setHelp(false)}>Got it<Check size={16} /></button></Dialog>}
  </div>
}

function StatCard({ label, Icon, value, caption, variant, locked, loading }: { label: string; Icon: LucideIcon; value: string; caption: string; variant: TransactionType; locked: boolean; loading: boolean }) {
  return <article className={`stat-card stat-${variant}`}><div className="stat-label">{label}<span className={`stat-icon type-${variant}`}><Icon size={18} strokeWidth={1.8} /></span></div><strong className="stat-value">{loading ? <span className="skeleton" /> : value}</strong><div className="stat-description">{locked ? <LockKeyhole size={11} /> : <span className={`tiny-dot type-${variant}`} />}<span>{locked ? 'Sign in to see your entries' : caption}</span></div></article>
}
