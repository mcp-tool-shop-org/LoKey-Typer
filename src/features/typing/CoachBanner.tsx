import { useEffect, useState } from 'react'
import type { CoachMessage } from '@lib-internal/coach'

export function CoachBanner({ message }: { message: CoachMessage | null }) {
  const [visible, setVisible] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!message) return
    // Fade in after a short delay
    const t = setTimeout(() => setVisible(true), 300)
    return () => clearTimeout(t)
  }, [message])

  useEffect(() => {
    if (!message || dismissed) return
    // Auto-fade after 8 seconds
    const t = setTimeout(() => setDismissed(true), 8000)
    return () => clearTimeout(t)
  }, [message, dismissed])

  if (!message || dismissed) return null

  return (
    <div
      className={[
        'rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-400 transition-opacity duration-500',
        visible ? 'opacity-100' : 'opacity-0',
      ].join(' ')}
    >
      <div className="flex items-center justify-between gap-3">
        <span>{message.text}</span>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="shrink-0 text-xs text-zinc-500 hover:text-zinc-300"
          aria-label="Dismiss"
        >
          &times;
        </button>
      </div>
    </div>
  )
}
