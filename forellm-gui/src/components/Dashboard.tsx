import type { SystemData, FitData, ModelFit, CartItem } from '../lib/types'
import { SystemTelemetry } from './SystemTelemetry'
import { HardwareSimulator } from './HardwareSimulator'
import { ModelExplorer } from './ModelExplorer'
import { MultiModelCart } from './MultiModelCart'
import { RefreshCw, Cpu } from 'lucide-react'

interface Props {
  systemData: SystemData | null
  fitData: FitData | null
  cartItems: CartItem[]
  loading: boolean
  simulating: boolean
  contextLength: number
  memoryOverride: string | null
  onSimulate: (memory: string | null) => void
  onContextChange: (ctx: number) => void
  onAddToCart: (model: ModelFit) => void
  onRemoveFromCart: (id: string) => void
  onClearCart: () => void
  onRefresh: () => void
}

export function Dashboard({
  systemData,
  fitData,
  cartItems,
  loading,
  simulating,
  contextLength,
  memoryOverride,
  onSimulate,
  onContextChange,
  onAddToCart,
  onRemoveFromCart,
  onClearCart,
  onRefresh
}: Props) {
  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-zinc-950">
      {/* Title bar */}
      <header className="flex h-10 shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-900/80 px-4 [-webkit-app-region:drag]">
        <div className="flex items-center gap-2 [-webkit-app-region:no-drag]">
          <Cpu className="h-4 w-4 text-emerald-400" />
          <span className="text-sm font-semibold tracking-wide text-zinc-200">
            ForeLLM
          </span>
          <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] text-emerald-400">
            v0.1
          </span>
          {simulating && (
            <span className="ml-2 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
              SIMULATED
            </span>
          )}
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-40 [-webkit-app-region:no-drag]"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </header>

      {/* Main grid */}
      <div className="grid min-h-0 flex-1 grid-cols-[280px_1fr] grid-rows-[1fr_auto] gap-px bg-zinc-800/50">
        {/* Left sidebar */}
        <div className="flex flex-col gap-px overflow-y-auto bg-zinc-950">
          <SystemTelemetry
            system={systemData?.system ?? fitData?.system ?? null}
            loading={loading}
          />
          <HardwareSimulator
            currentVram={
              systemData?.system?.gpu_vram_gb ??
              fitData?.system?.gpu_vram_gb ??
              0
            }
            simulating={simulating}
            memoryOverride={memoryOverride}
            onSimulate={onSimulate}
          />
        </div>

        {/* Main content: Model Explorer */}
        <div className="overflow-hidden bg-zinc-950">
          <ModelExplorer
            models={fitData?.models ?? []}
            loading={loading}
            contextLength={contextLength}
            onContextChange={onContextChange}
            onAddToCart={onAddToCart}
            cartItems={cartItems}
          />
        </div>

        {/* Bottom cart — spans both columns */}
        <div className="col-span-2 bg-zinc-950">
          <MultiModelCart
            items={cartItems}
            vramAvailable={
              systemData?.system?.gpu_vram_gb ??
              fitData?.system?.gpu_vram_gb ??
              0
            }
            ramAvailable={
              systemData?.system?.total_ram_gb ??
              fitData?.system?.total_ram_gb ??
              0
            }
            onRemove={onRemoveFromCart}
            onClear={onClearCart}
          />
        </div>
      </div>
    </div>
  )
}
