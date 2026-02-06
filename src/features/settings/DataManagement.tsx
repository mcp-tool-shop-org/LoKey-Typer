import { useRef, useState } from 'react'
import { exportAllData, importData, resetAllData, type ExportPayload } from '@lib-internal/dataExport'

export function DataManagement() {
  const [status, setStatus] = useState('')
  const [confirmReset, setConfirmReset] = useState(false)
  const [resetInput, setResetInput] = useState('')
  const [keepPrefs, setKeepPrefs] = useState(true)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const handleExport = async () => {
    setStatus('Exporting...')
    try {
      const data = await exportAllData()
      const json = JSON.stringify(data, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)

      const date = new Date().toISOString().slice(0, 10)
      const a = document.createElement('a')
      a.href = url
      a.download = `lokey-typer-export-${date}.json`
      a.click()
      URL.revokeObjectURL(url)

      setStatus(`Exported ${data.sessions.length} sessions + all data.`)
    } catch {
      setStatus('Export failed.')
    }
  }

  const handleImport = async (file: File) => {
    setStatus('Importing...')
    try {
      const text = await file.text()
      const payload = JSON.parse(text) as ExportPayload

      if (!payload.version || !payload.exportedAt) {
        setStatus('Invalid file: not a LoKey Typer export.')
        return
      }

      const result = await importData(payload)
      const parts = [`Imported ${result.imported} items.`]
      for (const w of result.warnings) parts.push(w)
      setStatus(parts.join(' '))
    } catch {
      setStatus('Import failed: invalid JSON or corrupt file.')
    }
  }

  const handleReset = async () => {
    if (resetInput !== 'RESET') return
    setStatus('Resetting...')
    try {
      await resetAllData({ keepPreferences: keepPrefs })
      setStatus(keepPrefs ? 'All data cleared. Preferences kept.' : 'All data cleared.')
      setConfirmReset(false)
      setResetInput('')
    } catch {
      setStatus('Reset failed.')
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
      <div className="text-sm font-semibold text-zinc-50">Data management</div>
      <div className="text-xs text-zinc-400">
        All data lives locally in your browser. Export to back up, import to restore.
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleExport}
          className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs font-semibold text-zinc-100 outline-none hover:bg-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-200 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
        >
          Export your data
        </button>

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs font-semibold text-zinc-100 outline-none hover:bg-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-200 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
        >
          Import data
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleImport(file)
            e.target.value = ''
          }}
        />
      </div>

      {!confirmReset ? (
        <button
          type="button"
          onClick={() => setConfirmReset(true)}
          className="rounded-md border border-red-900/50 bg-zinc-950 px-3 py-2 text-xs font-semibold text-red-400 outline-none hover:bg-red-950/30 focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
        >
          Reset everything
        </button>
      ) : (
        <div className="space-y-2 rounded-lg border border-red-900/50 bg-red-950/10 p-3">
          <div className="text-xs text-red-400">
            This will permanently delete all your progress, history, and profile. Type <strong>RESET</strong> to confirm.
          </div>
          <label className="flex items-center gap-2 text-xs text-zinc-400">
            <input
              type="checkbox"
              checked={keepPrefs}
              onChange={(e) => setKeepPrefs(e.target.checked)}
            />
            Keep preferences (sound, ambient, font)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={resetInput}
              onChange={(e) => setResetInput(e.target.value)}
              placeholder="Type RESET"
              className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-zinc-500"
            />
            <button
              type="button"
              onClick={handleReset}
              disabled={resetInput !== 'RESET'}
              className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
            >
              Confirm
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmReset(false)
                setResetInput('')
              }}
              className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs font-semibold text-zinc-100 hover:bg-zinc-900"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {status ? <div className="text-xs text-zinc-400">{status}</div> : null}
    </div>
  )
}
