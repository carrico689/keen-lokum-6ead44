import { useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowRight, Eye, Mail } from 'lucide-react'

export function ViewerInviteForm({ onRefresh, onUnauthorized }: { onRefresh: () => Promise<void>; onUnauthorized: () => void }) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const response = await fetch('/api/access', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'inviteViewer', email: email.trim(), name: name.trim() }),
      })
      const result = await response.json()
      if (response.status === 401 || response.status === 403) {
        onUnauthorized()
        return
      }
      await onRefresh()
      if (!response.ok) throw new Error(result.error ?? 'The invitation could not be sent.')
      setMessage(result.message)
      setEmail('')
      setName('')
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The invitation could not be sent. Please try again.')
    } finally { setBusy(false) }
  }

  return <section className="panel viewer-invite-panel" aria-labelledby="viewer-invite-title">
    <div className="panel-heading"><div><h2 id="viewer-invite-title"><Eye size={17} /> Invite a view-only visitor</h2><p>Send a private email invitation to view REGIONS without editing access.</p></div></div>
    <form className="entry-form viewer-invite-form" onSubmit={submit} aria-busy={busy}>
      <div className="form-grid">
        <label>Visitor email<span className="input-icon"><Mail size={17} /><input type="email" autoComplete="email" required maxLength={254} disabled={busy} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Enter their email address" /></span></label>
        <label>Name (optional)<input type="text" autoComplete="name" maxLength={100} disabled={busy} value={name} onChange={(event) => setName(event.target.value)} placeholder="Name shown in your workspace" /></label>
      </div>
      <p className="form-note">Viewers can see all accounts, account numbers, transactions, and activity, and download exports. They cannot add, edit, delete, or invite others. Only invite someone you trust with this information.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="form-success" role="status">{message}</p>}
      <button className="button button-primary" type="submit" disabled={busy}>{busy ? 'Sending invitation…' : 'Send view-only invitation'}<ArrowRight size={16} /></button>
    </form>
  </section>
}
