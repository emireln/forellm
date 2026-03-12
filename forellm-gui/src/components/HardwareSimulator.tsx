import { useState } from 'react'
import { GPU_PRESETS, cn } from '../lib/types'
import { FlaskConical, Power, ChevronDown } from 'lucide-react'

interface Props {
  currentVram: number
  simulating: boolean
  memoryOverride: string | null
  onSimulate: (memory: string | null) => void
}

export function HardwareSimulator({
  currentVram,
  simulating,
  memoryOverride,
  onSimulate
}: Props) {
  const [customVram, setCustomVram] = useState('')
  const [showPresets, setShowPresets] = useState(false)

  function handlePreset(vram: number) {
    onSimulate(`${vram}G`)
    setShowPresets(false)
  }

  function handleCustom() {
    const val = parseInt(customVram, 10)
    if (val > 0) onSimulate(`${val}G`)
  }

  function handleReset() {
    onSimulate(null)
    setCustomVram('')
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <FlaskConical className="h-3.5 w-3.5 text-amber-400" />
        What-If Simulator
        {simulating && (
          <span className="ml-auto rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] text-amber-400">
            ACTIVE
          </span>
        )}
      </div>

      <div className="space-y-3 p-4">
        <p className="text-[11px] leading-relaxed text-zinc-500">
          Override VRAM to simulate different GPUs. Model scores recalculate
          instantly via <span className="mono text-zinc-400">forellm --memory</span>.
        </p>

        {/* Current / override display */}
        <div className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-950 px-3 py-2">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">
            Active VRAM
          </span>
          <span
            className={cn(
              'mono text-sm font-semibold',
              simulating ? 'text-amber-400' : 'text-emerald-400'
            )}
          >
            {memoryOverride ?? `${currentVram.toFixed(0)}G`}
          </span>
        </div>

        {/* GPU Presets */}
        <div className="relative">
          <button
            onClick={() => setShowPresets(!showPresets)}
            className="flex w-full items-center justify-between rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-300 transition hover:border-zinc-600"
          >
            Select GPU Preset
            <ChevronDown
              className={cn(
                'h-3.5 w-3.5 text-zinc-500 transition',
                showPresets && 'rotate-180'
              )}
            />
          </button>
          {showPresets && (
            <div className="absolute z-10 mt-1 max-h-52 w-full overflow-y-auto rounded border border-zinc-700 bg-zinc-900 shadow-lg">
              {GPU_PRESETS.map((g) => (
                <button
                  key={g.name}
                  onClick={() => handlePreset(g.vram)}
                  className="flex w-full items-center justify-between px-3 py-1.5 text-left text-xs text-zinc-300 transition hover:bg-zinc-800"
                >
                  <span>{g.name}</span>
                  <span className="mono text-zinc-500">{g.vram} GB</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Custom VRAM */}
        <div className="flex gap-2">
          <input
            type="number"
            placeholder="Custom GB"
            value={customVram}
            onChange={(e) => setCustomVram(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCustom()}
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-1.5 font-mono text-xs text-zinc-300 outline-none placeholder:text-zinc-600 focus:border-cyan-500/50"
          />
          <button
            onClick={handleCustom}
            disabled={!customVram}
            className="shrink-0 rounded border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-400 transition hover:bg-cyan-500/20 disabled:opacity-30"
          >
            Apply
          </button>
        </div>

        {/* Reset */}
        {simulating && (
          <button
            onClick={handleReset}
            className="flex w-full items-center justify-center gap-2 rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-400 transition hover:bg-zinc-700 hover:text-zinc-200"
          >
            <Power className="h-3 w-3" />
            Reset to Detected Hardware
          </button>
        )}
      </div>
    </div>
  )
}
