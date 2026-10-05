import { useState } from 'react'
import type { FormEvent } from 'react'
import { acceptInvite, login, requestPasswordRecovery, updateUser } from '@netlify/identity'
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from 'lucide-react'
import { Dialog } from './Dialog'

export type AuthMode = { kind: 'login' | 'setup' | 'forgot' | 'invite' | 'recovery'; token?: string }

export function AuthDialog({ initial, onClose, onDone }: { initial: AuthMode; onClose: () => void; onDone: (message: string) => void }) {
  const [mode, setMode] = useState(initial.kind)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [role, setRole] = useState('team')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const newPassword = mode === 'invite' || mode === 'recovery'
  const title = newPassword ? 'Make it your own.' : mode === 'setup' ? 'Open your workspace.' : mode === 'forgot' ? 'A fresh start.' : 'Welcome to REGIONS.'

  function switchMode(next: typeof mode) {
    setMode(next)
    setError('')
    setMessage('')
    setPassword('')
    setConfirmPassword('')
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')
    if (newPassword && (password.length < 12 || password !== confirmPassword)) {
      setError(password.length < 12 ? 'Use at least 12 characters for your password.' : 'Your passwords do not match.')
      return
    }
    setBusy(true)
    try {
      if (mode === 'login') {
        await login(email.trim(), password)
        onDone('Welcome back. REGIONS is ready.')
      } else if (mode === 'setup') {
        const response = await fetch('/api/access', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim() }) })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error ?? 'Your invitation could not be requested.')
        setMessage(result.message)
      } else if (mode === 'forgot') {
        await requestPasswordRecovery(email.trim())
        setMessage('If this account exists, a reset link is on its way. Check your inbox and spam folder.')
      } else if (mode === 'invite') {
        if (!initial.token) throw new Error('This invitation is no longer available. Request a new one.')
        await acceptInvite(initial.token, password)
        onDone('Your access is ready. Welcome to REGIONS.')
      } else {
        await updateUser({ password })
        onDone('Your password has been updated.')
      }
    } catch (failure) {
      const status = typeof failure === 'object' && failure && 'status' in failure ? failure.status : undefined
      setError(mode === 'login' && (status === 401 || status === 400) ? 'The email or password is incorrect. Please try again.' : failure instanceof Error ? failure.message : 'Access is temporarily unavailable. Please try again.')
    } finally { setBusy(false) }
  }

  return <Dialog title={title} eyebrow="REGIONS" onClose={onClose} busy={busy}>
    <p className="dialog-description">{newPassword ? 'Set a private password to secure your personal workspace.' : mode === 'setup' ? 'Use an approved email to receive a private invitation and choose your own password.' : mode === 'forgot' ? 'Enter your account email and we’ll send a password reset link.' : 'One private place for your accounts and every little detail.'}</p>
    {mode === 'login' && <div className="segmented auth-segmented"><button type="button" className={role === 'team' ? 'active' : ''} onClick={() => setRole('team')}><ShieldCheck size={16} /> Team access</button><button type="button" className={role === 'viewer' ? 'active' : ''} onClick={() => setRole('viewer')}><Eye size={16} /> View-only access</button></div>}
    <form onSubmit={submit} className="entry-form">
      {!newPassword && <label>Email address<span className="input-icon"><Mail size={17} /><input type="email" autoComplete="username" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Your approved email address" /></span></label>}
      {(mode === 'login' || newPassword) && <label>{newPassword ? 'New password' : 'Password'}<span className="input-icon password-input"><LockKeyhole size={17} /><input type={showPassword ? 'text' : 'password'} autoComplete={newPassword ? 'new-password' : 'current-password'} minLength={newPassword ? 12 : undefined} maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder={newPassword ? 'At least 12 characters' : 'Enter your password'} /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label>}
      {newPassword && <label>Confirm password<input type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Enter your password again" /></label>}
      {mode === 'login' && <div className="form-note"><span>{role === 'team' ? 'Create and edit your entries.' : 'Explore entries without making changes.'}</span><button type="button" className="text-button" onClick={() => switchMode('forgot')}>Forgot password?</button></div>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="form-success" role="status">{message}</p>}
      <button className="button button-primary full-width" type="submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : mode === 'setup' ? 'Send my invitation' : mode === 'forgot' ? 'Send reset link' : 'Save my password'}<ArrowRight size={17} /></button>
    </form>
    {!newPassword && <p className="auth-switch">{mode === 'login' ? 'First time here?' : 'Already have access?'} <button type="button" className="text-button" onClick={() => switchMode(mode === 'login' ? 'setup' : 'login')}>{mode === 'login' ? 'Set up your access' : 'Sign in'}</button></p>}
    <div className="auth-security"><ShieldCheck size={15} /><span>Your permissions are assigned securely to your account.</span></div>
  </Dialog>
}
