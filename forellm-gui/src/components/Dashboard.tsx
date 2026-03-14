import { useEffect, useState } from 'react'
import type { SystemData, FitData, ModelFit, CartItem, HardwareOverride } from '../lib/types'
import { HardwarePanel } from './HardwarePanel'
import { ModelExplorer } from './ModelExplorer'
import { AgentFore } from './AgentFore'
import { MultiModelCart } from './MultiModelCart'
import { Documentation } from './Documentation'
import { RefreshCw, Minus, Square, X, PanelLeftClose, PanelLeftOpen, BookOpen, Layers, Bot } from 'lucide-react'
import type { SystemInfo } from '../lib/types'

type MainView = 'explorer' | 'agent'

/** Effective hardware for cart/simulator: from override or detected system. */
function getEffectiveHardware(
  system: SystemInfo | null,
  hardwareOverride: HardwareOverride | null
): { vramGb: number; ramGb: number; cores: number } {
  const vram = system?.gpu_vram_gb ?? 0
  const ram = system?.total_ram_gb ?? 0
  const cores = system?.cpu_cores ?? 0
  const vramGb = hardwareOverride?.memory != null
    ? (parseFloat(hardwareOverride.memory.replace(/G$/i, '')) || vram)
    : vram
  const ramGb = hardwareOverride?.ram != null
    ? (parseFloat(hardwareOverride.ram.replace(/G$/i, '')) || ram)
    : ram
  const coresEffective = hardwareOverride?.cores ?? cores
  return { vramGb, ramGb, cores: coresEffective }
}

/** Windows-style "restore down" icon: two overlapping outlined squares */
function RestoreDownIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="square"
    >
      <rect x="1" y="5" width="10" height="10" />
      <rect x="5" y="1" width="10" height="10" />
    </svg>
  )
}

interface Props {
  systemData: SystemData | null
  fitData: FitData | null
  cartItems: CartItem[]
  loading: boolean
  simulating: boolean
  contextLength: number
  hardwareOverride: HardwareOverride | null
  runnableCountDetected: number | null
  onSimulate: (override: HardwareOverride | null) => void
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
  hardwareOverride,
  runnableCountDetected,
  onSimulate,
  onContextChange,
  onAddToCart,
  onRemoveFromCart,
  onClearCart,
  onRefresh
}: Props) {
  const [isMaximized, setIsMaximized] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)
  const [docsOpen, setDocsOpen] = useState(false)
  const [mainView, setMainView] = useState<MainView>('explorer')

  useEffect(() => {
    if (typeof window !== 'undefined' && window.forellm) {
      window.forellm.isMaximized().then(setIsMaximized)
      window.forellm.onWindowMaximizedChange(setIsMaximized)
    }
  }, [])

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden rounded-xl bg-zinc-950">
      {docsOpen && <Documentation onClose={() => setDocsOpen(false)} />}
      {/* Title bar */}
      <header className="flex h-10 shrink-0 items-center justify-between rounded-t-xl border-b border-zinc-800 bg-zinc-900/80 px-4 [-webkit-app-region:drag]">
        <div className="flex items-center gap-2 [-webkit-app-region:no-drag]">
          <span className="text-sm font-semibold tracking-wide text-zinc-200">
            ForeLLM
          </span>
          <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] text-emerald-400">
            v0.32.2026
          </span>
          {simulating && (
            <span className="ml-2 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
              SIMULATED
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5 [-webkit-app-region:no-drag]">
          <button
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-40"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Loading…' : 'Refresh'}
          </button>
          <button
            onClick={() => setDocsOpen(true)}
            className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
            title="Documentation"
          >
            <BookOpen className="h-3 w-3" />
            Docs
          </button>
          {typeof window !== 'undefined' && window.forellm && (
            <>
              <button
                onClick={() => window.forellm.minimize()}
                className="rounded p-1.5 text-zinc-400 transition hover:bg-zinc-700 hover:text-zinc-200"
                title="Minimize"
              >
                <Minus className="h-4 w-4" />
              </button>
              <button
                onClick={() => window.forellm.maximize()}
                className="rounded p-1.5 text-zinc-400 transition hover:bg-zinc-700 hover:text-zinc-200"
                title={isMaximized ? 'Restore down' : 'Maximize'}
              >
                {isMaximized ? (
                  <RestoreDownIcon className="h-4 w-4" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
              </button>
              <button
                onClick={() => window.forellm.close()}
                className="rounded p-1.5 text-zinc-400 transition hover:bg-red-500/20 hover:text-red-400"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </header>

      {/* Main layout: flex so sidebar width can transition smoothly (no grid) */}
      <div className="flex min-h-0 flex-1 flex-col gap-px bg-zinc-800/50">
        <div className="flex min-h-0 flex-1">
          {/* Left sidebar — animate width only for smooth collapse/expand */}
          <div
            className="flex shrink-0 flex-col overflow-hidden border-r border-zinc-800/60 bg-zinc-950/95"
            style={{ width: sidebarCollapsed ? 52 : 260 }}
          >
            {sidebarCollapsed ? (
            <>
              <div className="min-h-0 flex-1" />
              <div className="shrink-0 border-t border-zinc-800/60 px-2 py-2">
                <button
                  type="button"
                  onClick={() => setSidebarCollapsed(false)}
                  className="flex w-full items-center justify-center rounded-md py-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
                  title="Expand hardware"
                >
                  <PanelLeftOpen className="h-4 w-4" />
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden px-3 py-4 scrollbar-thin">
                <HardwarePanel
                  system={systemData?.system ?? fitData?.system ?? null}
                  loading={loading}
                  models={fitData?.models ?? []}
                  contextLength={contextLength}
                  hardwareOverride={hardwareOverride}
                  runnableCountDetected={runnableCountDetected}
                  onSimulate={onSimulate}
                  onContextChange={onContextChange}
                />
              </div>
              <div className="shrink-0 border-t border-zinc-800/60 px-2 py-2">
                <button
                  type="button"
                  onClick={() => setSidebarCollapsed(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-md py-2 text-xs text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
                  title="Collapse sidebar"
                >
                  <PanelLeftClose className="h-4 w-4" />
                  <span>Collapse</span>
                </button>
              </div>
            </>
            )}
          </div>

          {/* Main content: Model Explorer or Agent Fore */}
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-zinc-950">
            {/* Top bar: Model Explorer | Agent Fore */}
            <div className="flex shrink-0 items-center gap-1 border-b border-zinc-800 px-3 py-1.5">
              <button
                type="button"
                onClick={() => setMainView('explorer')}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wider transition ${
                  mainView === 'explorer'
                    ? 'bg-zinc-800 text-zinc-200'
                    : 'text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-300'
                }`}
              >
                <Layers className="h-3.5 w-3.5 text-cyan-400" />
                Model Explorer
              </button>
              <button
                type="button"
                onClick={() => setMainView('agent')}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wider transition ${
                  mainView === 'agent'
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'text-zinc-500 hover:bg-zinc-800/60 hover:text-emerald-400/90'
                }`}
                title="AI agent with system specs and model knowledge"
              >
                <Bot className="h-4 w-4 text-emerald-400" />
                Agent Fore
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              {mainView === 'explorer' && (
                <ModelExplorer
                  models={fitData?.models ?? []}
                  loading={loading}
                  contextLength={contextLength}
                  onContextChange={onContextChange}
                  onAddToCart={onAddToCart}
                  cartItems={cartItems}
                />
              )}
              {mainView === 'agent' && (
                <AgentFore
                  system={systemData?.system ?? fitData?.system ?? null}
                  models={fitData?.models ?? []}
                  contextLength={contextLength}
                  loading={loading}
                />
              )}
            </div>
          </div>
        </div>

        {/* Multi-Model Cart — only visible when there are items */}
        {cartItems.length > 0 && (
          <div className="shrink-0 bg-zinc-950">
            <MultiModelCart
              items={cartItems}
              vramAvailable={getEffectiveHardware(systemData?.system ?? fitData?.system ?? null, hardwareOverride).vramGb}
              ramAvailable={getEffectiveHardware(systemData?.system ?? fitData?.system ?? null, hardwareOverride).ramGb}
              coresAvailable={getEffectiveHardware(systemData?.system ?? fitData?.system ?? null, hardwareOverride).cores}
              isSimulated={simulating}
              onRemove={onRemoveFromCart}
              onClear={onClearCart}
            />
          </div>
        )}
      </div>
    </div>
  )
}
