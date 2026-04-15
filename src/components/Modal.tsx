import { useEffect } from 'react'
import { X } from 'lucide-react'

type ModalProps = {
  title: string
  open: boolean
  onClose: () => void
  children: React.ReactNode
}

export function Modal({ title, open, onClose, children }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div
        className={[
          'relative z-10 flex max-h-[min(92dvh,calc(100dvh-env(safe-area-inset-top)-0.5rem))] w-full flex-col overflow-hidden rounded-t-3xl border border-[var(--color-border)] border-b-0 bg-[var(--color-surface-raised)] shadow-2xl shadow-black/40 sm:max-h-[90dvh] sm:max-w-lg sm:rounded-2xl sm:border-b',
          'pb-[env(safe-area-inset-bottom)]',
        ].join(' ')}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 py-4 sm:px-5">
          <h2
            id="modal-title"
            className="min-w-0 pr-2 text-lg font-semibold tracking-tight text-white"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-zinc-400 hover:bg-white/5 hover:text-white"
            aria-label="Close"
          >
            <X className="size-6" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5 sm:py-5">
          {children}
        </div>
      </div>
    </div>
  )
}
