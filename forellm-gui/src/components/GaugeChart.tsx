import { useEffect, useState, useRef, memo } from 'react'
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

function GaugeChartInner({ value, max, label, unit = 'GB', color, size = 80 }: Props) {
  const ratio = max > 0 ? Math.min(value / max, 1) : 0
  const c = COLORS[color ?? pickColor(ratio)]
  const r = (size - 8) / 2
  const circumference = 2 * Math.PI * r
  const arc = circumference * 0.75
  const clampedRatio = ratio >= 1 ? 0.999 : ratio
  const targetOffset = arc - arc * clampedRatio

  const [offset, setOffset] = useState(arc)
  const lastTargetRef = useRef<number | null>(null)

  useEffect(() => {
    if (lastTargetRef.current === targetOffset) return
    lastTargetRef.current = targetOffset
    const t = requestAnimationFrame(() => setOffset(targetOffset))
    return () => cancelAnimationFrame(t)
  }, [targetOffset])

  const cx = size / 2
  const strokeHalf = 2
  const clipR = r + strokeHalf
  const clipId = `gauge-clip-${size}-${(color ?? 'auto')}-${label.replace(/\s+/g, '-')}`

  return (
    <div className="flex flex-1 flex-col items-center gap-2">
      <div
        className="relative flex items-center justify-center overflow-hidden rounded-full"
        style={{ width: size, height: size, minWidth: size, minHeight: size }}
      >
        <svg
          width={size}
          height={size}
          className="absolute -rotate-[135deg]"
          aria-hidden
          style={{ overflow: 'hidden', display: 'block' }}
        >
          <defs>
            <clipPath id={clipId}>
              <circle cx={cx} cy={cx} r={clipR} />
            </clipPath>
          </defs>
          <g clipPath={`url(#${clipId})`}>
            <circle
              cx={cx}
              cy={cx}
              r={r}
              fill="none"
              stroke="#27272a"
              strokeWidth={4}
              strokeDasharray={`${arc} ${circumference}`}
              strokeLinecap="butt"
            />
            <circle
              cx={cx}
              cy={cx}
              r={r}
              fill="none"
              stroke={c.stroke}
              strokeWidth={4}
              strokeDasharray={`${arc} ${circumference}`}
            strokeDashoffset={offset}
            strokeLinecap="butt"
            style={{ transition: 'stroke-dashoffset 0.4s ease-out' }}
          />
          </g>
        </svg>
        <div
          className="pointer-events-none absolute inset-0 grid place-items-center text-center"
          style={{ padding: 4 }}
          aria-hidden
        >
          <div className="grid grid-cols-1 gap-0">
            <span className={cn('mono text-sm font-semibold leading-tight', c.text)}>
              {value.toFixed(1)}
            </span>
            <span className="text-[9px] leading-tight text-zinc-500">
              {unit || '\u00A0'}
            </span>
          </div>
        </div>
      </div>
      <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </span>
    </div>
  )
}

export const GaugeChart = memo(GaugeChartInner)
