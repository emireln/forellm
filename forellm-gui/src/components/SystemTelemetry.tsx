import type { SystemInfo } from '../lib/types'
import { GaugeChart } from './GaugeChart'
import { Activity, Cpu, HardDrive, MonitorSpeaker } from 'lucide-react'

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

export function SystemTelemetry({ system, loading }: Props) {
  if (loading && !system) return <div className="panel"><Skeleton /></div>

  const s = system
  if (!s) return null

  const ramUsed = s.total_ram_gb - s.available_ram_gb

  return (
    <div className="panel">
      <div className="panel-header">
        <Activity className="h-3.5 w-3.5 text-emerald-400" />
        System Telemetry
      </div>

      {/* Gauges */}
      <div className="flex items-center justify-around px-2 py-4">
        <GaugeChart
          value={ramUsed}
          max={s.total_ram_gb}
          label="RAM Used"
          color="cyan"
        />
        <GaugeChart
          value={s.gpu_vram_gb}
          max={s.gpu_vram_gb}
          label="VRAM"
          color="green"
        />
        <GaugeChart
          value={s.cpu_cores}
          max={s.cpu_cores}
          label="Cores"
          unit=""
          color="amber"
          size={72}
        />
      </div>

      {/* Details */}
      <div className="space-y-1.5 border-t border-zinc-800 px-4 py-3 text-xs">
        <Row icon={<Cpu className="h-3 w-3" />} label="CPU" value={s.cpu_name} />
        <Row
          icon={<HardDrive className="h-3 w-3" />}
          label="RAM"
          value={`${s.total_ram_gb.toFixed(1)} GB total / ${s.available_ram_gb.toFixed(1)} GB free`}
          mono
        />
        <Row
          icon={<MonitorSpeaker className="h-3 w-3" />}
          label="GPU"
          value={s.has_gpu ? s.gpu_name : 'None detected'}
        />
        {s.has_gpu && (
          <Row
            label="VRAM"
            value={`${s.gpu_vram_gb.toFixed(1)} GB${s.unified_memory ? ' (unified)' : ''}`}
            mono
          />
        )}
        <Row label="Backend" value={s.backend} />
        {s.os && <Row label="OS" value={s.os} />}
      </div>
    </div>
  )
}

function Row({
  icon,
  label,
  value,
  mono
}: {
  icon?: React.ReactNode
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex items-start gap-2">
      {icon && <span className="mt-0.5 text-zinc-600">{icon}</span>}
      <span className="w-14 shrink-0 text-zinc-500">{label}</span>
      <span
        className={`truncate text-zinc-300 ${mono ? 'font-mono tabular-nums' : ''}`}
        title={value}
      >
        {value}
      </span>
    </div>
  )
}
