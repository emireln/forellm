import { useState, memo, useEffect } from 'react'
import type { SystemInfo } from '../lib/types'
import type { HardwareOverride } from '../lib/types'
import { GPU_PRESETS, cn } from '../lib/types'
import { FlaskConical, Power, ChevronDown } from 'lucide-react'

interface Props {
  system: SystemInfo | null
  hardwareOverride: HardwareOverride | null
  onSimulate: (override: HardwareOverride | null) => void
  /** When true, render only the form (no panel wrapper or header). For use inside HardwarePanel. */
  compact?: boolean
}

function HardwareSimulatorInner({
  system,
  hardwareOverride,
  onSimulate,
  compact = false
}: Props) {
  const [customVram, setCustomVram] = useState('')
  const [customRam, setCustomRam] = useState('')
  const [customCores, setCustomCores] = useState('')
  const [showPresets, setShowPresets] = useState(false)

  const detectedVram = system?.gpu_vram_gb ?? 0
  const detectedRam = system?.total_ram_gb ?? 0
  const detectedCores = system?.cpu_cores ?? 0

  const effectiveVram = hardwareOverride?.memory ?? `${Math.round(detectedVram)}G`
  const effectiveRamGb =
    hardwareOverride?.ram != null
      ? parseFloat(hardwareOverride.ram.replace(/G$/i, '')) || detectedRam
      : detectedRam
  const effectiveCores = hardwareOverride?.cores ?? detectedCores

  const simulating = hardwareOverride != null

  useEffect(() => {
    if (simulating) {
      if (hardwareOverride?.memory) {
        const match = hardwareOverride.memory.match(/^(\d+(?:\.\d+)?)/)
        setCustomVram(match ? match[1] : '')
      }
      if (hardwareOverride?.ram) setCustomRam(hardwareOverride.ram.replace(/G$/i, ''))
      if (hardwareOverride?.cores != null) setCustomCores(String(hardwareOverride.cores))
    } else {
      setCustomVram('')
      setCustomRam('')
      setCustomCores('')
    }
  }, [simulating, hardwareOverride?.memory, hardwareOverride?.ram, hardwareOverride?.cores])

  function handlePreset(vram: number) {
    onSimulate({
      ...hardwareOverride,
      memory: `${vram}G`
    })
    setShowPresets(false)
  }

  function handleApply() {
    const memory = customVram
      ? `${parseInt(customVram, 10) || 0}G`
      : hardwareOverride?.memory ?? (detectedVram > 0 ? `${Math.round(detectedVram)}G` : undefined)
    const ramStr = customRam.trim().replace(/G$/i, '')
    const ram = ramStr ? `${parseFloat(ramStr) || 0}G` : undefined
    const coresRaw = parseInt(customCores, 10)
    const cores = Number.isNaN(coresRaw) || coresRaw < 1 ? undefined : coresRaw

    if (!memory && !ram && cores == null) {
      onSimulate(null)
      return
    }
    onSimulate({ memory, ram, cores })
  }

  function handleReset() {
    onSimulate(null)
    setCustomVram('')
    setCustomRam('')
    setCustomCores('')
  }

  const formContent = (
    <div className={compact ? 'space-y-4' : 'space-y-4 p-4'}>
      {!compact && (
        <p className="text-[11px] leading-relaxed text-zinc-500">
          Build a virtual hardware profile (VRAM, RAM, CPU cores). Model fit and scores
          update for the simulated system.
        </p>
      )}

        {/* Active hardware summary */}
        <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 py-2.5">
          <div className="flex items-center justify-between text-[10px]">
            <span className="font-medium uppercase tracking-wider text-zinc-500">VRAM</span>
            <span className={cn('mono font-semibold', simulating ? 'text-amber-400' : 'text-emerald-400')}>
              {effectiveVram}
            </span>
          </div>
          <div className="flex items-center justify-between text-[10px]">
            <span className="font-medium uppercase tracking-wider text-zinc-500">RAM</span>
            <span className={cn('mono font-semibold', simulating ? 'text-amber-400' : 'text-emerald-400')}>
              {effectiveRamGb.toFixed(1)} GB
            </span>
          </div>
          <div className="flex items-center justify-between text-[10px]">
            <span className="font-medium uppercase tracking-wider text-zinc-500">Cores</span>
            <span className={cn('mono font-semibold', simulating ? 'text-amber-400' : 'text-emerald-400')}>
              {effectiveCores}
            </span>
          </div>
        </div>

        {/* GPU / VRAM */}
        <div className="relative">
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            GPU VRAM
          </label>
          <button
            onClick={() => setShowPresets(!showPresets)}
            className="flex w-full items-center justify-between rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-2.5 text-xs text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-800"
          >
            Select GPU Preset
            <ChevronDown
              className={cn(
                'h-3.5 w-3.5 text-zinc-500 transition-transform duration-200',
                showPresets && 'rotate-180'
              )}
            />
          </button>
          {showPresets && (
            <div className="absolute z-10 mt-1.5 max-h-52 w-full overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl animate-dropdown-in">
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
        <div className="flex gap-2">
          <input
            type="number"
            placeholder={`Custom VRAM (e.g. ${Math.round(detectedVram)}G)`}
            value={customVram}
            onChange={(e) => setCustomVram(e.target.value)}
            min={1}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 font-mono text-xs text-zinc-300 outline-none placeholder:text-zinc-600 focus:border-cyan-500/50"
          />
        </div>

        {/* RAM */}
        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            System RAM (GB)
          </label>
          <input
            type="number"
            placeholder={detectedRam.toFixed(1)}
            value={customRam}
            onChange={(e) => setCustomRam(e.target.value)}
            min={1}
            step={0.5}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 font-mono text-xs text-zinc-300 outline-none placeholder:text-zinc-600 focus:border-cyan-500/50"
          />
        </div>

        {/* CPU Cores */}
        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            CPU Cores
          </label>
          <input
            type="number"
            placeholder={String(detectedCores)}
            value={customCores}
            onChange={(e) => setCustomCores(e.target.value)}
            min={1}
            max={256}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 font-mono text-xs text-zinc-300 outline-none placeholder:text-zinc-600 focus:border-cyan-500/50"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleApply}
            className="flex-1 rounded border border-cyan-500/30 bg-cyan-500/10 py-2 text-xs font-medium text-cyan-400 transition hover:bg-cyan-500/20"
          >
            Apply
          </button>
          {simulating && (
            <button
              onClick={handleReset}
              className="flex items-center justify-center gap-2 rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-400 transition hover:bg-zinc-700 hover:text-zinc-200"
            >
              <Power className="h-3 w-3" />
              Reset
            </button>
          )}
        </div>
      </div>
  )

  if (compact) return formContent

  return (
    <div className="panel animate-sidebar-in animate-sidebar-in-delay-1">
      <div className="panel-header">
        <FlaskConical className="h-3.5 w-3.5 text-amber-400" />
        What-If Simulator
        {simulating && (
          <span className="ml-auto rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-medium text-amber-400">
            ACTIVE
          </span>
        )}
      </div>
      {formContent}
    </div>
  )
}

export const HardwareSimulator = memo(HardwareSimulatorInner)
