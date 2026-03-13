import { useState, memo } from 'react'
import type { SystemInfo } from '../lib/types'
import type { HardwareOverride } from '../lib/types'
import { HardwareSimulator } from './HardwareSimulator'
import { ChevronDown, Cpu, HardDrive, MonitorSpeaker, MemoryStick, Server, Activity } from 'lucide-react'
import { cn } from '../lib/types'

interface Props {
  system: SystemInfo | null
  loading: boolean
  hardwareOverride: HardwareOverride | null
  onSimulate: (override: HardwareOverride | null) => void
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

function HardwarePanelInner({ system, loading, hardwareOverride, onSimulate }: Props) {
  const [showWhatIf, setShowWhatIf] = useState(false)
  const [showDetails, setShowDetails] = useState(false)

  if (loading && !system) {
    return (
      <div className="panel animate-sidebar-in p-4">
        <div className="h-4 w-24 animate-pulse rounded bg-zinc-800" />
        <div className="mt-3 h-3 w-full animate-pulse rounded bg-zinc-800/50" />
      </div>
    )
  }
  if (!system) return null

  return (
    <div className="panel animate-sidebar-in">
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
          </div>
        )}
      </div>
    </div>
  )
}

export const HardwarePanel = memo(HardwarePanelInner)
