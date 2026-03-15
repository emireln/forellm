export interface SystemInfo {
  cpu_name: string
  cpu_cores: number
  total_ram_gb: number
  available_ram_gb: number
  has_gpu: boolean
  gpu_name: string
  gpu_vram_gb: number
  gpu_count?: number
  gpu_backend?: string
  backend: string
  unified_memory: boolean
  os?: string
}

export interface SystemData {
  system: SystemInfo
}

export type FitLevel = 'Perfect' | 'Good' | 'Marginal' | 'TooTight'

export interface ScoreComponents {
  quality: number
  speed: number
  fit: number
  context: number
}

export interface ModelFit {
  name: string
  provider: string
  parameter_count: string
  params_b?: number
  fit_level: FitLevel
  run_mode: string
  score: number
  score_components?: ScoreComponents
  estimated_tps: number
  memory_required_gb: number
  memory_available_gb: number
  utilization_pct: number
  best_quant: string
  use_case: string
  context_length: number
  runtime?: string
  is_moe?: boolean
  notes?: string[]
}

export interface FitData {
  system: SystemInfo
  models: ModelFit[]
}

/** What-if simulator overrides (VRAM, RAM, CPU cores). Omitted fields use detected values. */
export interface HardwareOverride {
  memory?: string
  ram?: string
  cores?: number
}

export interface GpuPreset {
  name: string
  vram: number
  label: string
}

export const GPU_PRESETS: GpuPreset[] = [
  { name: 'RTX 4090', vram: 24, label: 'NVIDIA RTX 4090 — 24 GB' },
  { name: 'RTX 4080 SUPER', vram: 16, label: 'NVIDIA RTX 4080 SUPER — 16 GB' },
  { name: 'RTX 3090', vram: 24, label: 'NVIDIA RTX 3090 — 24 GB' },
  { name: 'RTX 3080', vram: 10, label: 'NVIDIA RTX 3080 — 10 GB' },
  { name: 'A100 80GB', vram: 80, label: 'NVIDIA A100 — 80 GB' },
  { name: 'A100 40GB', vram: 40, label: 'NVIDIA A100 — 40 GB' },
  { name: 'H100', vram: 80, label: 'NVIDIA H100 — 80 GB' },
  { name: 'L40S', vram: 48, label: 'NVIDIA L40S — 48 GB' },
  { name: 'Apple M2 Max', vram: 32, label: 'Apple M2 Max — 32 GB Unified' },
  { name: 'Apple M3 Max', vram: 36, label: 'Apple M3 Max — 36 GB Unified' },
  { name: 'Apple M4 Max', vram: 128, label: 'Apple M4 Max — 128 GB Unified' },
  { name: '2x RTX 4090', vram: 48, label: '2× NVIDIA RTX 4090 — 48 GB' },
  { name: '2x A100 80GB', vram: 160, label: '2× NVIDIA A100 — 160 GB' }
]

export const QUANT_HIERARCHY = [
  { name: 'Q2_K', bpw: 0.25, quality: 'Low' },
  { name: 'Q3_K_M', bpw: 0.375, quality: 'Low-Med' },
  { name: 'Q4_K_M', bpw: 0.5, quality: 'Medium' },
  { name: 'Q5_K_M', bpw: 0.625, quality: 'Med-High' },
  { name: 'Q6_K', bpw: 0.75, quality: 'High' },
  { name: 'Q8_0', bpw: 1.0, quality: 'Very High' },
  { name: 'FP16', bpw: 2.0, quality: 'Full' }
]

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}
