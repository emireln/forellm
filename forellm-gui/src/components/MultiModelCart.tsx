import type { CartItem } from '../lib/types'
import { cn } from '../lib/types'
import { FitBadge } from './FitBadge'
import { ShoppingCart, X, Trash2, AlertTriangle, CheckCircle } from 'lucide-react'

interface Props {
  items: CartItem[]
  vramAvailable: number
  ramAvailable: number
  onRemove: (id: string) => void
  onClear: () => void
}

export function MultiModelCart({
  items,
  vramAvailable,
  ramAvailable,
  onRemove,
  onClear
}: Props) {
  const totalVram = items.reduce((s, i) => s + i.model.memory_required_gb, 0)
  const fits = totalVram <= vramAvailable
  const fitsRam = totalVram <= ramAvailable
  const pct = vramAvailable > 0 ? Math.min((totalVram / vramAvailable) * 100, 100) : 0

  if (items.length === 0) {
    return (
      <div className="flex items-center gap-2 border-t border-zinc-800 px-4 py-2 text-xs text-zinc-600">
        <ShoppingCart className="h-3.5 w-3.5" />
        <span>
          Multi-Model Cart — Add models from the table above to check
          cumulative memory usage
        </span>
      </div>
    )
  }

  return (
    <div className="border-t border-zinc-800">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-2">
        <ShoppingCart className="h-3.5 w-3.5 text-cyan-400" />
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Multi-Model Cart
        </span>
        <span className="mono rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500">
          {items.length} model{items.length !== 1 && 's'}
        </span>
        <button
          onClick={onClear}
          className="ml-auto flex items-center gap-1 rounded px-2 py-0.5 text-[10px] text-zinc-500 transition hover:bg-zinc-800 hover:text-red-400"
        >
          <Trash2 className="h-3 w-3" />
          Clear
        </button>
      </div>

      <div className="flex items-start gap-4 px-4 py-3">
        {/* Model list */}
        <div className="flex flex-1 flex-wrap gap-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-2 rounded border border-zinc-700 bg-zinc-800/50 px-2.5 py-1.5 text-xs"
            >
              <FitBadge level={item.model.fit_level} />
              <span className="font-medium text-zinc-200">
                {item.model.name.split('/').pop()}
              </span>
              <span className="mono text-zinc-500">
                {item.model.memory_required_gb.toFixed(1)} GB
              </span>
              <button
                onClick={() => onRemove(item.id)}
                className="text-zinc-600 transition hover:text-red-400"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="w-72 shrink-0 space-y-2">
          {/* VRAM bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px]">
              <span className="uppercase tracking-wider text-zinc-500">
                Total VRAM Required
              </span>
              <span
                className={cn(
                  'mono font-semibold',
                  fits ? 'text-emerald-400' : 'text-red-400'
                )}
              >
                {totalVram.toFixed(1)} / {vramAvailable.toFixed(0)} GB
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-zinc-800">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  fits
                    ? 'bg-gradient-to-r from-emerald-500/60 to-cyan-500/60'
                    : 'bg-gradient-to-r from-red-500/60 to-amber-500/60'
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* Status */}
          <div
            className={cn(
              'flex items-center gap-2 rounded border px-2.5 py-1.5 text-xs',
              fits
                ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400'
                : fitsRam
                  ? 'border-amber-500/30 bg-amber-500/5 text-amber-400'
                  : 'border-red-500/30 bg-red-500/5 text-red-400'
            )}
          >
            {fits ? (
              <>
                <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                Combined stack fits in VRAM
              </>
            ) : fitsRam ? (
              <>
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Exceeds VRAM — CPU offload required
              </>
            ) : (
              <>
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Exceeds available memory
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
