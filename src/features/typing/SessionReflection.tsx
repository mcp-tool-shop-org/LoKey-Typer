import { useState } from 'react'
import { appendJournalAsync } from '@lib'

const TAGS = ['fatigue', 'focus', 'keyboard change', 'new exercise', 'just practicing'] as const

export function SessionReflection({ sessionTimestamp }: { sessionTimestamp: number }) {
  const [note, setNote] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [saved, setSaved] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  if (dismissed || saved) return null

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
  }

  const handleSave = async () => {
    if (!note.trim() && selectedTags.length === 0) {
      setDismissed(true)
      return
    }
    await appendJournalAsync({
      sessionTimestamp,
      timestamp: Math.floor(Date.now() / 1000),
      note: note.trim(),
      tags: selectedTags,
    })
    setSaved(true)
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
      <div className="text-sm font-medium text-zinc-200">Quick reflection</div>

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="What felt different today?"
        maxLength={280}
        rows={2}
        className="mt-2 w-full resize-none rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-zinc-500 focus-visible:ring-2 focus-visible:ring-zinc-200/30"
      />

      <div className="mt-2 flex flex-wrap gap-1.5">
        {TAGS.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => toggleTag(tag)}
            className={[
              'rounded-full border px-2.5 py-1 text-xs transition',
              selectedTags.includes(tag)
                ? 'border-zinc-500 bg-zinc-800 text-zinc-100'
                : 'border-zinc-700 bg-zinc-950 text-zinc-400 hover:border-zinc-600',
            ].join(' ')}
          >
            {tag}
          </button>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          className="rounded-md bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-white"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs font-semibold text-zinc-100 hover:bg-zinc-900"
        >
          Skip
        </button>
      </div>
    </div>
  )
}
