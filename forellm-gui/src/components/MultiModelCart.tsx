import type { CartItem } from '../lib/types'
import { cn } from '../lib/types'
import { FitBadge } from './FitBadge'
import { ShoppingCart, X, Trash2, AlertTriangle, CheckCircle, MemoryStick } from 'lucide-react'

interface Props {
  items: CartItem[]
  vramAvailable: number
  ramAvailable: number
  coresAvailable?: number
  isSimulated?: boolean
  onRemove: (id: string) => void
  onClear: () => void
}

export function MultiModelCart({
  items,
  vramAvailable,
  ramAvailable,
  coresAvailable = 0,
  isSimulated = false,
  onRemove,
  onClear
}: Props) {
  const totalMem = items.reduce((s, i) => s + i.model.memory_required_gb, 0)
  const fitsVram = totalMem <= vramAvailable
  const fitsRam = totalMem <= ramAvailable
  const pctVram = vramAvailable > 0 ? Math.min((totalMem / vramAvailable) * 100, 100) : 0
  const pctRam = ramAvailable > 0 ? Math.min((totalMem / ramAvailable) * 100, 100) : 0

  if (items.length === 0) {
    return (
      <div className="flex items-center gap-3 border-t border-zinc-800/80 bg-zinc-900/40 px-4 py-3">
        <ShoppingCart className="h-4 w-4 shrink-0 text-zinc-600" />
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
        {isSimulated && (
          <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
            vs simulated hardware
          </span>
        )}
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

        {/* Summary: full hardware (VRAM, RAM, Cores) like What-If simulator */}
        <div className="w-80 shrink-0 space-y-3">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-zinc-500">
            <MemoryStick className="h-3 w-3" />
            Effective hardware {isSimulated && '(simulated)'}
          </div>
          <div className="grid grid-cols-3 gap-2 text-[10px]">
            <div className="rounded border border-zinc-700/80 bg-zinc-800/50 px-2 py-1.5">
              <span className="text-zinc-500">VRAM</span>
              <span className="mono ml-1 font-medium text-zinc-300">{vramAvailable.toFixed(0)} GB</span>
            </div>
            <div className="rounded border border-zinc-700/80 bg-zinc-800/50 px-2 py-1.5">
              <span className="text-zinc-500">RAM</span>
              <span className="mono ml-1 font-medium text-zinc-300">{ramAvailable.toFixed(0)} GB</span>
            </div>
            <div className="rounded border border-zinc-700/80 bg-zinc-800/50 px-2 py-1.5">
              <span className="text-zinc-500">Cores</span>
              <span className="mono ml-1 font-medium text-zinc-300">{coresAvailable}</span>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px]">
              <span className="uppercase tracking-wider text-zinc-500">Total memory required</span>
              <span className="mono font-semibold text-zinc-300">{totalMem.toFixed(1)} GB</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  fitsVram
                    ? 'bg-gradient-to-r from-emerald-500/60 to-cyan-500/60'
                    : fitsRam
                      ? 'bg-gradient-to-r from-amber-500/60 to-orange-500/60'
                      : 'bg-gradient-to-r from-red-500/60 to-amber-500/60'
                )}
                style={{ width: `${vramAvailable > 0 ? Math.min(pctVram, 100) : (ramAvailable > 0 ? pctRam : 0)}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-zinc-500">
              <span>VRAM: {totalMem.toFixed(1)} / {vramAvailable.toFixed(0)} GB</span>
              <span>RAM: {totalMem.toFixed(1)} / {ramAvailable.toFixed(0)} GB</span>
            </div>
          </div>

          {/* Status */}
          <div
            className={cn(
              'flex items-center gap-2 rounded border px-2.5 py-1.5 text-xs',
              fitsVram
                ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400'
                : fitsRam
                  ? 'border-amber-500/30 bg-amber-500/5 text-amber-400'
                  : 'border-red-500/30 bg-red-500/5 text-red-400'
            )}
          >
            {fitsVram ? (
              <>
                <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                Combined stack fits in VRAM
              </>
            ) : fitsRam ? (
              <>
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Exceeds VRAM — fits in RAM (CPU offload)
              </>
            ) : (
              <>
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Exceeds available VRAM and RAM
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
