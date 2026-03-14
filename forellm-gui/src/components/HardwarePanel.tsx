import { useState, memo, useEffect } from 'react'
import type { SystemInfo, ModelFit, HardwareOverride } from '../lib/types'
import { HardwareSimulator } from './HardwareSimulator'
import { GPU_PRESETS, cn } from '../lib/types'
import { ChevronDown, Cpu, HardDrive, MonitorSpeaker, MemoryStick, Server, Activity, Copy } from 'lucide-react'

const CTX_SHORTCUTS: { label: string; value: number }[] = [
  { label: '4K', value: 4096 },
  { label: '8K', value: 8192 },
  { label: '32K', value: 32768 },
  { label: '128K', value: 131072 }
]

interface Props {
  system: SystemInfo | null
  loading: boolean
  models: ModelFit[]
  contextLength: number
  hardwareOverride: HardwareOverride | null
  runnableCountDetected: number | null
  onSimulate: (override: HardwareOverride | null) => void
  onContextChange: (ctx: number) => void
}

function SpecRow({
  icon,
  label,
  value
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-md px-2 py-1.5 text-xs hover:bg-zinc-800/50">
      <span className="flex h-[14px] w-[14px] shrink-0 items-center justify-center text-zinc-500">{icon}</span>
      <span className="w-14 shrink-0 font-medium text-zinc-500">{label}</span>
      <span className="min-w-0 flex-1 truncate text-zinc-300" title={value}>
        {value}
      </span>
    </div>
  )
}

function HardwarePanelInner({
  system,
  loading,
  models,
  contextLength,
  hardwareOverride,
  runnableCountDetected,
  onSimulate,
  onContextChange
}: Props) {
  const [showPresets, setShowPresets] = useState(true)
  const [showContextInPresets, setShowContextInPresets] = useState(false)
  const [showWhatIf, setShowWhatIf] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [copyFeedback, setCopyFeedback] = useState(false)
  const [activePresetKey, setActivePresetKey] = useState<string | null>(null)

  const quickPresetGpus = GPU_PRESETS.slice(0, 4)
  useEffect(() => {
    if (hardwareOverride == null) {
      if (activePresetKey !== null && activePresetKey !== 'Current') setActivePresetKey(null)
      return
    }
    const presets = GPU_PRESETS.slice(0, 4)
    const match = presets.find(
      (g) =>
        hardwareOverride!.memory === `${g.vram}G` &&
        hardwareOverride!.ram == null &&
        hardwareOverride!.cores == null
    )
    if (match) setActivePresetKey(match.name)
    else setActivePresetKey(null)
  }, [hardwareOverride?.memory, hardwareOverride?.ram, hardwareOverride?.cores])

  if (loading && !system) {
    return (
      <div className="panel animate-sidebar-in p-4">
        <div className="h-4 w-24 animate-pulse rounded bg-zinc-800" />
        <div className="mt-3 h-3 w-full animate-pulse rounded bg-zinc-800/50" />
      </div>
    )
  }
  if (!system) return null

  const vramGb = hardwareOverride?.memory != null
    ? (parseFloat(hardwareOverride.memory.replace(/G$/i, '')) || (system?.gpu_vram_gb ?? 0))
    : (system?.gpu_vram_gb ?? 0)
  const ramGb = hardwareOverride?.ram != null
    ? (parseFloat(hardwareOverride.ram.replace(/G$/i, '')) || (system?.total_ram_gb ?? 0))
    : (system?.total_ram_gb ?? 0)
  const cores = hardwareOverride?.cores ?? (system?.cpu_cores ?? 0)
  const simulating = hardwareOverride != null

  const perfect = models.filter((m) => m.fit_level === 'Perfect').length
  const good = models.filter((m) => m.fit_level === 'Good').length
  const marginal = models.filter((m) => m.fit_level === 'Marginal').length
  const tooTight = models.filter((m) => m.fit_level === 'TooTight').length
  const runnable = models.filter((m) => m.fit_level !== 'TooTight').length
  const gainDelta = simulating && runnableCountDetected != null ? runnable - runnableCountDetected : null

  const handleCopyProfile = () => {
    const profile = { vram_gb: vramGb, ram_gb: ramGb, cores, context: contextLength }
    navigator.clipboard.writeText(JSON.stringify(profile, null, 2)).then(() => {
      setCopyFeedback(true)
      setTimeout(() => setCopyFeedback(false), 1500)
    })
  }

  return (
    <div className="panel animate-sidebar-in overflow-hidden">
      {/* Fit summary — at top, outside Quick presets */}
      <div className="border-b border-zinc-800/60 px-3 py-2.5">
        <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500">Fit summary</p>
        <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-zinc-400">
          <span className="text-emerald-400">{perfect} Perfect</span>
          <span>·</span>
          <span className="text-cyan-400">{good} Good</span>
          <span>·</span>
          <span className="text-amber-400">{marginal} Marginal</span>
          <span>·</span>
          <span className="text-red-400/90">{tooTight} Too tight</span>
        </div>
        <p className="mt-1 text-[10px] text-zinc-500">{runnable} runnable</p>
      </div>

      {/* Quick presets — collapsible; Context inside, collapsed by default */}
      <div
        className={cn(
          'border-b border-zinc-800/60',
          !showPresets && 'rounded-b-xl'
        )}
      >
        <button
          type="button"
          onClick={() => setShowPresets(!showPresets)}
          className="flex w-full items-center justify-between px-3 py-2.5 text-left text-xs font-medium text-zinc-400 transition hover:bg-zinc-800/50 hover:text-zinc-300"
        >
          Quick presets
          <ChevronDown className={cn('h-3.5 w-3.5 text-zinc-500 transition-transform', showPresets && 'rotate-180')} />
        </button>
        {showPresets ? (
          <div className="border-t border-zinc-800/60 overflow-hidden px-3 pb-2.5 pt-1">
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setActivePresetKey('Current')
                  onSimulate(null)
                }}
                className={cn(
                  'rounded px-2 py-1 text-[10px] font-medium transition',
                  !simulating
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300'
                )}
              >
                Current
              </button>
              {quickPresetGpus.map((g) => {
                const override = { memory: `${g.vram}G` }
                const isActive = activePresetKey === g.name
                return (
                  <button
                    key={g.name}
                    type="button"
                    onClick={() => {
                      setActivePresetKey(g.name)
                      onSimulate(override)
                    }}
                    className={cn(
                      'rounded px-2 py-1 text-[10px] font-medium transition',
                      isActive ? 'bg-amber-500/20 text-amber-400' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300'
                    )}
                  >
                    {g.name}
                  </button>
                )
              })}
            </div>
            {/* Context — nested, collapsed by default */}
            <div className="mt-2 border-t border-zinc-800/50">
              <button
                type="button"
                onClick={() => setShowContextInPresets(!showContextInPresets)}
                className="flex w-full items-center justify-between py-2 text-left text-[10px] font-medium text-zinc-500 transition hover:text-zinc-400"
              >
                Context
                <ChevronDown className={cn('h-3 w-3 text-zinc-500 transition-transform', showContextInPresets && 'rotate-180')} />
              </button>
              {showContextInPresets && (
                <div className="flex flex-wrap gap-1.5 pb-1">
                  {CTX_SHORTCUTS.map(({ label, value }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => onContextChange(value)}
                      className={cn(
                        'rounded px-2 py-1 font-mono text-[10px] font-medium transition',
                        contextLength === value
                          ? 'bg-cyan-500/20 text-cyan-400'
                          : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300'
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {/* What-if — collapsible */}
      <div className="border-b border-zinc-800/60">
        <button
          type="button"
          onClick={() => setShowWhatIf(!showWhatIf)}
          className="flex w-full items-center justify-between px-3 py-2.5 text-left text-xs font-medium text-zinc-400 transition hover:bg-zinc-800/50 hover:text-zinc-300"
        >
          What-if simulator
          <ChevronDown className={cn('h-3.5 w-3.5 text-zinc-500 transition-transform', showWhatIf && 'rotate-180')} />
        </button>
        {showWhatIf && (
          <div className="border-t border-zinc-800/60 px-2 pb-3 pt-1">
            <HardwareSimulator
              system={system}
              hardwareOverride={hardwareOverride}
              onSimulate={onSimulate}
              compact
            />
          </div>
        )}
      </div>

      {/* Details (CPU, GPU, backend) — collapsible */}
      <div>
        <button
          type="button"
          onClick={() => setShowDetails(!showDetails)}
          className="flex w-full items-center justify-between px-3 py-2.5 text-left text-xs font-medium text-zinc-400 transition hover:bg-zinc-800/50 hover:text-zinc-300"
        >
          System details
          <ChevronDown className={cn('h-3.5 w-3.5 text-zinc-500 transition-transform', showDetails && 'rotate-180')} />
        </button>
        {showDetails && (
          <div className="space-y-0.5 border-t border-zinc-800/60 px-2 py-2">
            <SpecRow icon={<Cpu className="h-3.5 w-3.5 text-zinc-500" />} label="CPU" value={system.cpu_name} />
            <SpecRow
              icon={<HardDrive className="h-3.5 w-3.5 text-zinc-500" />}
              label="RAM"
              value={`${system.total_ram_gb.toFixed(1)} GB total / ${system.available_ram_gb.toFixed(1)} GB free`}
            />
            <SpecRow
              icon={<MonitorSpeaker className="h-3.5 w-3.5 text-zinc-500" />}
              label="GPU"
              value={system.has_gpu ? system.gpu_name : 'None'}
            />
            {system.has_gpu && (
              <SpecRow
                icon={<MemoryStick className="h-3.5 w-3.5 text-zinc-500" />}
                label="VRAM"
                value={`${system.gpu_vram_gb.toFixed(1)} GB${system.unified_memory ? ' (unified)' : ''}`}
              />
            )}
            <SpecRow icon={<Server className="h-3.5 w-3.5 text-zinc-500" />} label="Backend" value={system.backend} />
            {system.os && (
              <SpecRow icon={<Activity className="h-3.5 w-3.5 text-zinc-500" />} label="OS" value={system.os} />
            )}
            <div className="mt-3 border-t border-zinc-800/50 pt-2">
              <button
                type="button"
                onClick={handleCopyProfile}
                className="flex w-full items-center justify-center gap-2 rounded-md py-2 text-xs text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
                title="Copy hardware profile (JSON)"
              >
                <Copy className="h-3.5 w-3.5" />
                {copyFeedback ? 'Copied!' : 'Copy profile'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* What would I gain? — when simulating */}
      {gainDelta != null && gainDelta !== 0 && (
        <div className="border-b border-zinc-800/60 px-3 py-2.5">
          <p className="text-[11px] text-zinc-400">
            {gainDelta > 0 ? (
              <>
                <span className="text-emerald-400">+{gainDelta} more runnable</span>
                <span className="ml-1 text-zinc-500">vs your system</span>
              </>
            ) : (
              <>
                <span className="text-amber-400">{gainDelta} fewer runnable</span>
                <span className="ml-1 text-zinc-500">vs your system</span>
              </>
            )}
          </p>
        </div>
      )}
    </div>
  )
}

export const HardwarePanel = memo(HardwarePanelInner)
