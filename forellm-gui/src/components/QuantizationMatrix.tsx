import type { ModelFit } from '../lib/types'
import { QUANT_HIERARCHY, cn } from '../lib/types'

interface Props {
  model: ModelFit
  vramAvailable: number
}

export function QuantizationMatrix({ model, vramAvailable }: Props) {
  const paramsB = model.params_b ?? (parseFloat(model.parameter_count) || 0)

  return (
    <div className="space-y-2 rounded border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
      <h4 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-500">
        Quantization Comparison — {model.name.split('/').pop()}
      </h4>
      <div className="space-y-1">
        {QUANT_HIERARCHY.map((q) => {
          const sizeGb = (paramsB * q.bpw * 1e9) / (1024 ** 3) * 1.15
          const fits = sizeGb <= vramAvailable
          const pct = vramAvailable > 0 ? Math.min((sizeGb / vramAvailable) * 100, 100) : 0
          const isCurrent = q.name === model.best_quant

          return (
            <div
              key={q.name}
              className={cn(
                'flex items-center gap-3 rounded px-2 py-1 text-xs',
                isCurrent && 'bg-zinc-100 ring-1 ring-cyan-500/30 dark:bg-zinc-800/50'
              )}
            >
              <span
                className={cn(
                  'mono w-16 shrink-0 font-medium',
                  isCurrent ? 'text-cyan-600 dark:text-cyan-400' : 'text-zinc-600 dark:text-zinc-400'
                )}
              >
                {q.name}
              </span>
              <span className="w-14 shrink-0 text-zinc-600 dark:text-zinc-500">{q.quality}</span>

              {/* Bar */}
              <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                <div
                  className={cn(
                    'absolute inset-y-0 left-0 rounded-full transition-all duration-500',
                    fits ? 'bg-emerald-500/60' : 'bg-red-500/60'
                  )}
                  style={{ width: `${pct}%` }}
                />
                {/* threshold line */}
                <div
                  className="absolute inset-y-0 w-px bg-zinc-400 dark:bg-zinc-500"
                  style={{ left: '100%' }}
                />
              </div>

              <span
                className={cn(
                  'mono w-16 shrink-0 text-right',
                  fits ? 'text-zinc-700 dark:text-zinc-300' : 'text-red-600 dark:text-red-400'
                )}
              >
                {sizeGb.toFixed(1)} GB
              </span>

              {isCurrent && (
                <span className="shrink-0 rounded bg-cyan-500/10 px-1 py-0.5 text-[9px] text-cyan-600 dark:text-cyan-400">
                  BEST
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
