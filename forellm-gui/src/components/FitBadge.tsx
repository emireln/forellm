import type { FitLevel } from '../lib/types'
import { cn } from '../lib/types'

const STYLES: Record<FitLevel, string> = {
  Perfect: 'fit-perfect',
  Good: 'fit-good',
  Marginal: 'fit-marginal',
  TooTight: 'fit-tight'
}

const LABELS: Record<FitLevel, string> = {
  Perfect: 'Perfect',
  Good: 'Good',
  Marginal: 'Marginal',
  TooTight: 'Too Tight'
}

const DOTS: Record<FitLevel, string> = {
  Perfect: 'bg-emerald-400 shadow-neon-green',
  Good: 'bg-cyan-400 shadow-neon-cyan',
  Marginal: 'bg-amber-400 shadow-neon-amber',
  TooTight: 'bg-red-400 shadow-neon-red'
}

const FIT_LEVELS: FitLevel[] = ['Perfect', 'Good', 'Marginal', 'TooTight']

export function FitBadge({ level }: { level: FitLevel | string }) {
  // CLI JSON may send "Too Tight" (with space); normalize so badge always renders
  const raw = (level as string) === 'Too Tight' ? 'TooTight' : level
  const key: FitLevel = FIT_LEVELS.includes(raw as FitLevel) ? (raw as FitLevel) : 'Marginal'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
        STYLES[key]
      )}
    >
      <span className={cn('neon-dot', DOTS[key])} />
      {LABELS[key]}
    </span>
  )
}
