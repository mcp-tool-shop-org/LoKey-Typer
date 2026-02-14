import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { typewriterAudio, type AudioDiagnostics } from '@lib'
import { Icon } from '@app/components/Icon'
import { usePreferences } from '@app/providers/PreferencesProvider'

export function AudioDiagnosticsPage() {
  const [diagnostics, setDiagnostics] = useState<AudioDiagnostics | null>(null)
  const { prefs } = usePreferences()

  function handleExport() {
    const report = {
      app: { name: 'LoKey Types', version: '1.1.0', build: new Date().toISOString() },
      environment: {
        userAgent: navigator.userAgent,
        screen: { width: window.innerWidth, height: window.innerHeight },
        devicePixelRatio: window.devicePixelRatio
      },
      audio: diagnostics,
      preferences: prefs,
      timestamp: Date.now()
    }
    
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `lokey-diagnostics-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }
  
  // Poll diagnostics
  useEffect(() => {
    const update = () => {
      setDiagnostics(typewriterAudio.getDiagnostics())
    }
    update()
    const id = setInterval(update, 500)
    return () => clearInterval(id)
  }, [])

  function runTestSequence() {
      // Plays a quick sequence of available sounds
      const sequence = [
          { kind: 'key', delay: 0 },
          { kind: 'key', delay: 150 },
          { kind: 'key', delay: 300 },
          { kind: 'spacebar', delay: 450 },
          { kind: 'backspace', delay: 600 },
          { kind: 'return_bell', delay: 800 }
      ] as const
      
      sequence.forEach(({ kind, delay }) => {
          setTimeout(() => {
              typewriterAudio.play(kind, {
                  enabled: true,
                  volume: 1, // Bypass mix for test? Or use default
                  modeGain: 1,
                  category: kind === 'return_bell' ? 'ui' : 'typing'
              })
          }, delay)
      })
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 animate-fade-in p-6">
      <div className="flex items-center gap-4">
        <Link to="/settings" className="rounded-lg p-2 hover:bg-zinc-800 text-zinc-400">
             <Icon name="arrow-left" size={20} />
        </Link>
        <div>
           <h1 className="text-2xl font-bold text-zinc-100">Audio Diagnostics</h1>
           <p className="text-zinc-400">System health check and buffer status.</p>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
          {/* Status Card */}
          <div className="rounded-2xl bg-zinc-900/40 p-6 border border-zinc-800">
             <h3 className="text-sm font-semibold text-zinc-300 mb-4">Audio Context</h3>
             <div className="space-y-3">
                 <div className="flex justify-between items-center text-sm">
                     <span className="text-zinc-500">State</span>
                     <span className={`font-mono px-2 py-0.5 rounded ${
                         diagnostics?.state === 'running' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                     }`}>
                         {diagnostics?.state ?? 'Initial'}
                     </span>
                 </div>
                 <div className="flex justify-between items-center text-sm">
                     <span className="text-zinc-500">Buffers Loaded</span>
                     <span className="text-zinc-200 font-mono">
                         {diagnostics?.buffersLoaded} <span className="text-zinc-600">/</span> {diagnostics?.totalBuffers}
                     </span>
                 </div>
                 <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden mt-2">
                     <div 
                        className="bg-emerald-500 h-full transition-all duration-500"
                        style={{ width: `${(diagnostics?.buffersLoaded ?? 0) / (diagnostics?.totalBuffers || 1) * 100}%` }}
                     />
                 </div>
             </div>
          </div>

          {/* Activity Card */}
          <div className="rounded-2xl bg-zinc-900/40 p-6 border border-zinc-800">
             <h3 className="text-sm font-semibold text-zinc-300 mb-4">Activity Log</h3>
             <div className="space-y-3">
                 <div className="flex justify-between items-center text-sm">
                     <span className="text-zinc-500">Last Event</span>
                     <span className="font-mono text-zinc-200">
                         {diagnostics?.lastEvent ?? '-'}
                     </span>
                 </div>
                 
                 <button 
                    onClick={runTestSequence}
                    className="w-full mt-4 flex items-center justify-center gap-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 py-2 text-sm font-medium transition-colors"
                 >
                     <Icon name="play-circle" size={16} />
                     Run Test Sequence
                 </button>

                 <button 
                    onClick={() => {
                        typewriterAudio.resume().then(() => typewriterAudio.prewarm())
                    }}
                    className="w-full flex items-center justify-center gap-2 rounded-lg border border-zinc-700/50 hover:bg-zinc-800/50 text-zinc-300 py-2 text-sm font-medium transition-colors"
                 >
                     <Icon name="refresh" size={16} />
                     Recover Audio System
                 </button>

                 <button 
                    onClick={handleExport}
                    className="w-full mt-4 flex items-center justify-center gap-2 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 text-zinc-400 py-2 text-sm font-medium transition-colors"
                 >
                     <Icon name="download" size={16} />
                     Export Diagnostics
                 </button>
             </div>
          </div>
      </div>
      
      <div className="text-xs text-zinc-500 text-center">
          LoKey Audio Engine v1.0 • {diagnostics?.state === 'running' ? 'Active' : 'Standby'}
      </div>
    </div>
  )
}
