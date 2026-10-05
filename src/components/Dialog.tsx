import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'

export function Dialog({ title, eyebrow, children, onClose, busy = false, wide = false }: { title: string; eyebrow?: string; children: ReactNode; onClose: () => void; busy?: boolean; wide?: boolean }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const dialog = dialogRef.current
    const focused = document.activeElement as HTMLElement | null
    dialog?.showModal()
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      dialog?.close()
      document.body.style.overflow = originalOverflow
      focused?.focus()
    }
  }, [])

  return <dialog ref={dialogRef} className={`dialog ${wide ? 'dialog-wide' : ''}`} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); if (!busy) closeRef.current() }} onClick={(event) => { if (event.target === dialogRef.current && !busy) closeRef.current() }}>
    <div className="dialog-inner">
      <div className="dialog-heading"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h2 id={titleId}>{title}</h2></div><button className="icon-button" type="button" aria-label="Close dialog" disabled={busy} onClick={onClose}><X size={20} /></button></div>
      {children}
    </div>
  </dialog>
}
