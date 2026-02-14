import { Icon } from '@app/components/Icon'

export type ChipType = 'perfect' | 'streak' | 'best' | 'completed'

type Props = {
  type: ChipType
  label?: string
  visible?: boolean
}

export function ResultChip({ type, label, visible = true }: Props) {
  if (!visible) return null

  if (type === 'perfect') {
    return (
      <div className="inline-flex animate-fade-in items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-200">
        <Icon name="star" size={12} className="text-amber-400" />
        {label ?? 'Perfect Run'}
      </div>
    )
  }

  if (type === 'streak') {
    return (
      <div className="inline-flex animate-fade-in items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200">
        <Icon name="stat-streak" size={12} className="text-emerald-400" />
        {label ?? 'Streak +1'}
      </div>
    )
  }

  if (type === 'best') {
    return (
      <div className="inline-flex animate-fade-in items-center gap-1.5 rounded-full border border-purple-500/20 bg-purple-500/10 px-3 py-1 text-xs font-semibold text-purple-200">
        <Icon name="trophy" size={12} className="text-purple-400" />
        {label ?? 'New Best!'}
      </div>
    )
  }

  // Default: Completed
  return (
    <div className="inline-flex animate-fade-in items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-800/50 px-3 py-1 text-xs font-medium text-zinc-300">
      <Icon name="checkmark" size={12} className="text-zinc-500" />
      {label ?? 'Completed'}
    </div>
  )
}
