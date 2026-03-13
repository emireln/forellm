import { memo } from 'react'
import type { SystemInfo } from '../lib/types'
import { GaugeChart } from './GaugeChart'
import { Activity, Cpu, HardDrive, MonitorSpeaker, MemoryStick, Server } from 'lucide-react'

interface Props {
  system: SystemInfo | null
  loading: boolean
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-4 p-4">
      <div className="h-3 w-24 rounded bg-zinc-800" />
      <div className="flex justify-around">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 w-20 rounded-full bg-zinc-800/50" />
        ))}
      </div>
      <div className="space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-3 rounded bg-zinc-800" />
        ))}
      </div>
    </div>
  )
}

function SystemTelemetryInner({ system, loading }: Props) {
  if (loading && !system) return <div className="panel animate-sidebar-in"><Skeleton /></div>

  const s = system
  if (!s) return null

  const ramUsed = s.total_ram_gb - s.available_ram_gb

  return (
    <div className="panel animate-sidebar-in">
      <div className="panel-header">
        <Activity className="h-3.5 w-3.5 text-emerald-400" />
        System Telemetry
      </div>

      {/* Gauges — equal-width grid so all three align */}
      <div className="grid grid-cols-3 gap-4 px-4 py-5">
        <GaugeChart
          value={ramUsed}
          max={s.total_ram_gb}
          label="RAM Used"
          unit="GB"
          color="cyan"
        />
        <GaugeChart
          value={s.gpu_vram_gb}
          max={s.gpu_vram_gb}
          label="VRAM"
          unit="GB"
          color="green"
        />
        <GaugeChart
          value={s.cpu_cores}
          max={s.cpu_cores}
          label="Cores"
          unit=""
          color="amber"
        />
      </div>

      {/* Spec list — fixed icon column so labels and values align */}
      <div className="border-t border-zinc-800/80 px-3 py-3">
        <div className="space-y-0.5">
          <SpecRow icon={<Cpu className="h-3.5 w-3.5 shrink-0 text-zinc-500" />} label="CPU" value={s.cpu_name} />
          <SpecRow
            icon={<HardDrive className="h-3.5 w-3.5 shrink-0 text-zinc-500" />}
            label="RAM"
            value={`${s.total_ram_gb.toFixed(1)} GB total / ${s.available_ram_gb.toFixed(1)} GB free`}
            mono
          />
          <SpecRow
            icon={<MonitorSpeaker className="h-3.5 w-3.5 shrink-0 text-zinc-500" />}
            label="GPU"
            value={s.has_gpu ? s.gpu_name : 'None detected'}
          />
          {s.has_gpu && (
            <SpecRow
              icon={<MemoryStick className="h-3.5 w-3.5 shrink-0 text-zinc-500" />}
              label="VRAM"
              value={`${s.gpu_vram_gb.toFixed(1)} GB${s.unified_memory ? ' (unified)' : ''}`}
              mono
            />
          )}
          <SpecRow icon={<Server className="h-3.5 w-3.5 shrink-0 text-zinc-500" />} label="Backend" value={s.backend} />
          {s.os && (
            <SpecRow icon={<Activity className="h-3.5 w-3.5 shrink-0 text-zinc-500" />} label="OS" value={s.os} />
          )}
        </div>
      </div>
    </div>
  )
}

export const SystemTelemetry = memo(SystemTelemetryInner)

const ICON_SIZE = 'w-[14px]'

function SpecRow({
  icon,
  label,
  value,
  mono
}: {
  icon: React.ReactNode
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex items-center gap-3 rounded-md px-2 py-2 text-xs transition-colors hover:bg-zinc-800/50">
      <span className={`${ICON_SIZE} flex shrink-0 items-center justify-center`}>{icon}</span>
      <span className="w-14 shrink-0 font-medium text-zinc-500">{label}</span>
      <span
        className={`min-w-0 flex-1 truncate text-zinc-300 ${mono ? 'font-mono tabular-nums' : ''}`}
        title={value}
      >
        {value}
      </span>
    </div>
  )
}
