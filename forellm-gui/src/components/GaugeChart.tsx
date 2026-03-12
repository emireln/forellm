import { cn } from '../lib/types'

interface Props {
  value: number
  max: number
  label: string
  unit?: string
  color?: 'green' | 'cyan' | 'amber' | 'red'
  size?: number
}

const COLORS = {
  green: { stroke: '#22c55e', bg: 'rgba(34,197,94,0.1)', text: 'text-emerald-400' },
  cyan: { stroke: '#06b6d4', bg: 'rgba(6,182,212,0.1)', text: 'text-cyan-400' },
  amber: { stroke: '#f59e0b', bg: 'rgba(245,158,11,0.1)', text: 'text-amber-400' },
  red: { stroke: '#ef4444', bg: 'rgba(239,68,68,0.1)', text: 'text-red-400' }
}

function pickColor(ratio: number): 'green' | 'cyan' | 'amber' | 'red' {
  if (ratio < 0.5) return 'green'
  if (ratio < 0.75) return 'cyan'
  if (ratio < 0.9) return 'amber'
  return 'red'
}

export function GaugeChart({ value, max, label, unit = 'GB', color, size = 80 }: Props) {
  const ratio = max > 0 ? Math.min(value / max, 1) : 0
  const c = COLORS[color ?? pickColor(ratio)]
  const r = (size - 8) / 2
  const circumference = 2 * Math.PI * r
  const arc = circumference * 0.75
  const offset = arc - arc * ratio

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-[135deg]">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="#27272a"
            strokeWidth={4}
            strokeDasharray={`${arc} ${circumference}`}
            strokeLinecap="round"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={c.stroke}
            strokeWidth={4}
            strokeDasharray={`${arc} ${circumference}`}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
            style={{ filter: `drop-shadow(0 0 4px ${c.stroke}40)` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn('mono text-sm font-semibold', c.text)}>
            {value.toFixed(1)}
          </span>
          <span className="text-[9px] text-zinc-500">{unit}</span>
        </div>
      </div>
      <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </span>
    </div>
  )
}
