import { useMemo } from 'react'
import type { HistoryPoint } from '@lib'
import { usePreferences } from '@app'

type Props = {
  points: HistoryPoint[]
  metric: 'wpm' | 'accuracy'
  height?: number
  className?: string
  width?: number | string
}

export function ProgressSparkline({ points, metric, height = 60, className = '', width = '100%' }: Props) {
  const { prefs } = usePreferences()

  const data = useMemo(() => {
    return points.map((p) => ({
      val: metric === 'wpm' ? p.wpm : p.accuracy * 100,
      completed: p.dailyCompleted,
    }))
  }, [points, metric])

  if (data.length < 2) {
    // Render placeholder line (straight grey)
    return (
      <div className={`flex items-center justify-center rounded-lg bg-zinc-900/40 opacity-50 ${className}`} style={{ height }}>
        <div className="h-0.5 w-full bg-zinc-800" />
      </div>
    )
  }

  const minVal = Math.min(...data.map(d => d.val))
  const maxVal = Math.max(...data.map(d => d.val))
  const range = maxVal - minVal
  // Add padding: 10%
  const padding = range === 0 ? 10 : range * 0.2
  const lowerBound = Math.max(0, minVal - padding)
  const upperBound = maxVal + padding
  const graphRange = upperBound - lowerBound || 1

  const count = data.length
  // We distribute points horizontally 0..100
  const normalized = data.map((d, i) => {
    const x = i / (count - 1) * 100
    const y = 100 - ((d.val - lowerBound) / graphRange) * 100
    return { x, y, val: d.val, completed: d.completed }
  })

  // Build path
  const pointsString = normalized.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')
  
  // Completed dots
  const completedDots = normalized.filter(p => p.completed)

  // A11y description
  const label = \`Progress graph for \${metric === 'wpm' ? 'WPM' : 'accuracy'}, showing \${count} days.\`

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className={`overflow-visible ${className}`}
      style={{ height, width }}
    >
      {/* Background guide line (average?) - optional, skip for clean look */}
      
      {/* Main Path */}
      <polyline
        points={pointsString}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={prefs.reducedMotion ? '' : 'animate-draw-path'} // Custom CSS animation needed? Or just let standard render be static.
        // If reduced motion, just render.
      />

      {/* Data Points (last one always, others maybe too noisy?) */}
      {/* Let's show last point distinctly */}
      {normalized.length > 0 && (() => {
          const last = normalized[normalized.length - 1]
          return (
             <circle 
                cx={last.x} 
                cy={last.y} 
                r="3" 
                vectorEffect="non-scaling-stroke"
                className="fill-zinc-950 stroke-current"
                strokeWidth="2"
             />
          )
      })()}

      {/* Completion markers at baseline (y=100 or slightly below) */}
      {completedDots.map((p, i) => (
         <circle
           key={i}
           cx={p.x}
           cy={108} // Below graph area
           r="1.5"
           vectorEffect="non-scaling-stroke"
           className="fill-zinc-500/50"
         />
      ))}
    </svg>
  )
}
