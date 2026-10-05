import { useId, useState } from 'react'
import { ChartNoAxesCombined, ArrowRight, LockKeyhole } from 'lucide-react'
import { money, formatDate } from '../lib/ledger'
import type { Account, Transaction } from '../lib/ledger'

export function BalanceChart({ accounts, transactions, accountId, signedIn, canEdit, onStart }: { accounts: Account[]; transactions: Transaction[]; accountId: string; signedIn: boolean; canEdit: boolean; onStart: () => void }) {
  const gradientId = useId().replace(/:/g, '')
  const [hover, setHover] = useState<number | null>(null)
  const selected = accounts.filter((account) => accountId === 'all' || account.id === accountId)
  const selectedIds = new Set(selected.map((account) => account.id))
  const relevant = [...transactions].filter((transaction) => selectedIds.has(transaction.accountId) || (transaction.destinationId && selectedIds.has(transaction.destinationId))).sort((first, second) => first.date.localeCompare(second.date) || first.createdAt.localeCompare(second.createdAt) || first.id.localeCompare(second.id))
  let balance = selected.reduce((total, account) => total + account.openingCents, 0)
  const points: { date: string; balance: number }[] = []
  for (const transaction of relevant) {
    if (selectedIds.has(transaction.accountId)) balance += transaction.type === 'deposit' ? transaction.amountCents : -transaction.amountCents
    if (transaction.destinationId && selectedIds.has(transaction.destinationId)) balance += transaction.amountCents
    if (points.at(-1)?.date === transaction.date) points[points.length - 1].balance = balance
    else points.push({ date: transaction.date, balance })
  }
  const minimum = points.length ? Math.min(...points.map((point) => point.balance)) : 0
  const maximum = points.length ? Math.max(...points.map((point) => point.balance)) : 0
  const padding = Math.max((maximum - minimum) * .2, 10000)
  const low = minimum - padding
  const high = maximum + padding
  const coordinates = points.map((point, index) => ({ ...point, horizontal: points.length === 1 ? 320 : 30 + index / (points.length - 1) * 610, vertical: 178 - (point.balance - low) / (high - low) * 150 }))
  const line = coordinates.map((point, index) => `${index ? 'L' : 'M'}${point.horizontal},${point.vertical}`).join(' ')
  const current = hover !== null ? coordinates[hover] : undefined

  return <div className="balance-chart">
    <div className="chart-caption"><span className="chart-legend"><i /> Recorded balance</span><span className="subtle">Based on your entries</span></div>
    {points.length ? <div className="real-chart">
      <div className="chart-y-labels"><span>{money(high)}</span><span>{money((low + high) / 2)}</span><span>{money(low)}</span></div>
      <svg viewBox="0 0 670 208" role="img" aria-label={`Recorded balance across ${points.length} dates, ending at ${money(balance)}`} onMouseLeave={() => setHover(null)}>
        <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#38826b" stopOpacity=".2" /><stop offset="100%" stopColor="#38826b" stopOpacity=".01" /></linearGradient></defs>
        {[28, 103, 178].map((vertical) => <line key={vertical} x1="20" x2="650" y1={vertical} y2={vertical} stroke="#e6ebe7" strokeDasharray="4 6" />)}
        {points.length > 1 && <path d={`${line} L${coordinates.at(-1)!.horizontal},195 L${coordinates[0].horizontal},195 Z`} fill={`url(#${gradientId})`} />}
        <path d={line} fill="none" stroke="#2d7c62" strokeWidth="3" strokeLinejoin="round" />
        {coordinates.map((point, index) => <g key={point.date}><circle cx={point.horizontal} cy={point.vertical} r={hover === index ? 6 : 3} fill="#2d7c62" stroke="white" strokeWidth="2" /><circle cx={point.horizontal} cy={point.vertical} r="16" fill="transparent" onMouseEnter={() => setHover(index)}><title>{formatDate(point.date, true)}: {money(point.balance)}</title></circle></g>)}
      </svg>
      {current && <div className="chart-tooltip" role="status">{formatDate(current.date)} <strong>{money(current.balance)}</strong></div>}
      <div className="chart-x-labels"><span>{formatDate(points[0].date, true)}</span>{points.length > 1 && <span>{formatDate(points.at(-1)!.date, true)}</span>}</div>
    </div> : <div className="chart-empty"><div className="chart-empty-grid" /><div className="empty-chart-content"><span className="empty-icon">{signedIn ? <ChartNoAxesCombined size={25} strokeWidth={1.6} /> : <LockKeyhole size={24} strokeWidth={1.6} />}</span><h3>{signedIn ? 'Every entry tells a story.' : 'Your picture. Privately kept.'}</h3><p>{signedIn ? canEdit ? 'Record your first transaction to see your balance over time.' : 'Your balance history appears as the team records entries.' : 'Sign in to see your balances and activity come together.'}</p>{(!signedIn || canEdit) && <button type="button" className="text-button" onClick={onStart}>{signedIn ? 'Add your first entry' : 'Open REGIONS'}<ArrowRight size={14} /></button>}</div></div>}
  </div>
}
