import { useState, useMemo } from 'react'
import type { ModelFit, CartItem } from '../lib/types'
import { cn } from '../lib/types'
import { FitBadge } from './FitBadge'
import { QuantizationMatrix } from './QuantizationMatrix'
import {
  Search,
  SlidersHorizontal,
  ChevronDown,
  ChevronRight,
  ShoppingCart,
  Copy,
  Check,
  Loader2,
  Layers
} from 'lucide-react'

interface Props {
  models: ModelFit[]
  loading: boolean
  contextLength: number
  onContextChange: (ctx: number) => void
  onAddToCart: (model: ModelFit) => void
  cartItems: CartItem[]
}

const CTX_STOPS = [2048, 4096, 8192, 16384, 32768, 65536, 131072]

function formatCtx(n: number): string {
  return n >= 1024 ? `${(n / 1024).toFixed(0)}k` : String(n)
}

function ollamaTag(name: string): string | null {
  const n = name.toLowerCase()
  if (n.includes('llama-3.1-8b')) return 'llama3.1:8b'
  if (n.includes('llama-3.3-70b')) return 'llama3.3:70b'
  if (n.includes('llama-3.1-70b')) return 'llama3.1:70b'
  if (n.includes('qwen2.5-coder-7b')) return 'qwen2.5-coder:7b'
  if (n.includes('qwen2.5-coder-14b')) return 'qwen2.5-coder:14b'
  if (n.includes('qwen2.5-72b')) return 'qwen2.5:72b'
  if (n.includes('qwen2.5-7b')) return 'qwen2.5:7b'
  if (n.includes('deepseek-r1') && n.includes('32b')) return 'deepseek-r1:32b'
  if (n.includes('gemma-2-9b')) return 'gemma2:9b'
  if (n.includes('gemma-2-27b')) return 'gemma2:27b'
  if (n.includes('mistral-7b')) return 'mistral:7b'
  if (n.includes('phi-3-mini')) return 'phi3:mini'
  if (n.includes('phi-4-mini')) return 'phi4-mini'
  return null
}

export function ModelExplorer({
  models,
  loading,
  contextLength,
  onContextChange,
  onAddToCart,
  cartItems
}: Props) {
  const [search, setSearch] = useState('')
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [sortCol, setSortCol] = useState<'score' | 'params' | 'mem' | 'tps'>('score')
  const [sortAsc, setSortAsc] = useState(false)
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null)

  const cartNames = useMemo(
    () => new Set(cartItems.map((c) => c.model.name)),
    [cartItems]
  )

  const filtered = useMemo(() => {
    let list = models
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.provider.toLowerCase().includes(q) ||
          m.use_case.toLowerCase().includes(q) ||
          m.parameter_count.toLowerCase().includes(q)
      )
    }
    list = [...list].sort((a, b) => {
      let av: number, bv: number
      switch (sortCol) {
        case 'score': av = a.score; bv = b.score; break
        case 'params': av = a.params_b ?? 0; bv = b.params_b ?? 0; break
        case 'mem': av = a.memory_required_gb; bv = b.memory_required_gb; break
        case 'tps': av = a.estimated_tps; bv = b.estimated_tps; break
      }
      return sortAsc ? av - bv : bv - av
    })
    return list
  }, [models, search, sortCol, sortAsc])

  function toggleSort(col: typeof sortCol) {
    if (sortCol === col) setSortAsc(!sortAsc)
    else { setSortCol(col); setSortAsc(false) }
  }

  function copyCmd(cmd: string) {
    navigator.clipboard.writeText(cmd)
    setCopiedCmd(cmd)
    setTimeout(() => setCopiedCmd(null), 2000)
  }

  const ctxIdx = CTX_STOPS.indexOf(contextLength)
  const sliderVal = ctxIdx >= 0 ? ctxIdx : 1

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center gap-3 border-b border-zinc-800 px-4 py-2">
        <Layers className="h-3.5 w-3.5 text-cyan-400" />
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Model Explorer
        </span>
        <span className="mono rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500">
          {filtered.length}/{models.length}
        </span>

        {/* Search */}
        <div className="relative ml-auto">
          <Search className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-zinc-600" />
          <input
            type="text"
            placeholder="Search models…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-56 rounded border border-zinc-700 bg-zinc-950 py-1.5 pl-8 pr-3 text-xs text-zinc-300 outline-none placeholder:text-zinc-600 focus:border-cyan-500/50"
          />
        </div>

        {/* Context slider */}
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-3 w-3 text-zinc-600" />
          <span className="text-[10px] text-zinc-500">Context</span>
          <input
            type="range"
            min={0}
            max={CTX_STOPS.length - 1}
            value={sliderVal}
            onChange={(e) => onContextChange(CTX_STOPS[+e.target.value])}
            className="h-1 w-24 cursor-pointer appearance-none rounded-full bg-zinc-700 accent-cyan-500 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-400"
          />
          <span className="mono w-10 text-right text-[10px] text-cyan-400">
            {formatCtx(contextLength)}
          </span>
        </div>

        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-500" />}
      </div>

      {/* Table */}
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10 bg-zinc-900/95 backdrop-blur">
            <tr className="border-b border-zinc-800 text-left text-[10px] uppercase tracking-wider text-zinc-500">
              <th className="w-8 px-3 py-2" />
              <th className="px-3 py-2">Model</th>
              <th className="px-3 py-2">Provider</th>
              <SortTh label="Params" col="params" current={sortCol} asc={sortAsc} onClick={toggleSort} />
              <th className="px-3 py-2">Quant</th>
              <SortTh label="Mem Req" col="mem" current={sortCol} asc={sortAsc} onClick={toggleSort} />
              <SortTh label="Score" col="score" current={sortCol} asc={sortAsc} onClick={toggleSort} />
              <SortTh label="Tok/s" col="tps" current={sortCol} asc={sortAsc} onClick={toggleSort} />
              <th className="px-3 py-2">Fit</th>
              <th className="px-3 py-2">Use Case</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => {
              const expanded = expandedRow === m.name
              const inCart = cartNames.has(m.name)
              const tag = ollamaTag(m.name)

              return (
                <ModelRow
                  key={m.name}
                  model={m}
                  expanded={expanded}
                  inCart={inCart}
                  ollamaTag={tag}
                  copiedCmd={copiedCmd}
                  onToggleExpand={() => setExpandedRow(expanded ? null : m.name)}
                  onAddToCart={() => onAddToCart(m)}
                  onCopy={copyCmd}
                />
              )
            })}
            {filtered.length === 0 && !loading && (
              <tr>
                <td colSpan={11} className="px-4 py-12 text-center text-zinc-600">
                  No models match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SortTh({
  label,
  col,
  current,
  asc,
  onClick
}: {
  label: string
  col: string
  current: string
  asc: boolean
  onClick: (col: any) => void
}) {
  const active = current === col
  return (
    <th
      className="cursor-pointer select-none px-3 py-2 transition hover:text-zinc-300"
      onClick={() => onClick(col)}
    >
      <span className={active ? 'text-cyan-400' : ''}>
        {label}
        {active && <span className="ml-0.5">{asc ? '↑' : '↓'}</span>}
      </span>
    </th>
  )
}

function ModelRow({
  model: m,
  expanded,
  inCart,
  ollamaTag: tag,
  copiedCmd,
  onToggleExpand,
  onAddToCart,
  onCopy
}: {
  model: ModelFit
  expanded: boolean
  inCart: boolean
  ollamaTag: string | null
  copiedCmd: string | null
  onToggleExpand: () => void
  onAddToCart: () => void
  onCopy: (cmd: string) => void
}) {
  const runCmd = tag ? `ollama run ${tag}` : `forellm download "${m.name}"`

  return (
    <>
      <tr
        className={cn(
          'border-b border-zinc-800/50 transition hover:bg-zinc-800/30',
          expanded && 'bg-zinc-800/20',
          m.fit_level === 'TooTight' && 'opacity-50'
        )}
      >
        <td className="px-3 py-2">
          <button onClick={onToggleExpand} className="text-zinc-500 hover:text-zinc-300">
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
        </td>
        <td className="max-w-[200px] truncate px-3 py-2 font-medium text-zinc-200" title={m.name}>
          {m.name.split('/').pop()}
        </td>
        <td className="px-3 py-2 text-zinc-400">{m.provider}</td>
        <td className="mono px-3 py-2 text-zinc-300">{m.parameter_count}</td>
        <td className="mono px-3 py-2 text-zinc-400">{m.best_quant}</td>
        <td className="mono px-3 py-2 text-zinc-300">{m.memory_required_gb.toFixed(1)} GB</td>
        <td className="mono px-3 py-2">
          <span
            className={cn(
              'font-semibold',
              m.score >= 70 ? 'text-emerald-400' :
              m.score >= 50 ? 'text-cyan-400' :
              m.score >= 30 ? 'text-amber-400' : 'text-red-400'
            )}
          >
            {m.score.toFixed(0)}
          </span>
        </td>
        <td className="mono px-3 py-2 text-zinc-300">{m.estimated_tps.toFixed(1)}</td>
        <td className="px-3 py-2">
          <FitBadge level={m.fit_level} />
        </td>
        <td className="px-3 py-2 text-zinc-400">{m.use_case}</td>
        <td className="px-3 py-2 text-right">
          <div className="flex items-center justify-end gap-1">
            {m.fit_level !== 'TooTight' && (
              <button
                onClick={(e) => { e.stopPropagation(); onCopy(runCmd) }}
                title={runCmd}
                className="rounded p-1 text-zinc-500 transition hover:bg-zinc-700 hover:text-emerald-400"
              >
                {copiedCmd === runCmd ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onAddToCart() }}
              disabled={inCart || m.fit_level === 'TooTight'}
              title={inCart ? 'Already in cart' : 'Add to cart'}
              className={cn(
                'rounded p-1 transition',
                inCart
                  ? 'text-cyan-400'
                  : 'text-zinc-500 hover:bg-zinc-700 hover:text-cyan-400 disabled:opacity-30'
              )}
            >
              <ShoppingCart className="h-3.5 w-3.5" />
            </button>
          </div>
        </td>
      </tr>

      {/* Expanded quantization matrix */}
      {expanded && (
        <tr className="border-b border-zinc-800/50 bg-zinc-900/30">
          <td colSpan={11} className="px-6 py-3">
            <div className="flex gap-4">
              <div className="flex-1">
                <QuantizationMatrix
                  model={m}
                  vramAvailable={m.memory_available_gb}
                />
              </div>
              <div className="w-64 shrink-0 space-y-2">
                <div className="rounded border border-zinc-800 bg-zinc-950 p-3 text-xs">
                  <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    Run Command
                  </h4>
                  <div className="flex items-center gap-2 rounded bg-zinc-900 px-2 py-1.5">
                    <code className="mono flex-1 text-emerald-400">{runCmd}</code>
                    <button
                      onClick={() => onCopy(runCmd)}
                      className="shrink-0 text-zinc-500 hover:text-zinc-300"
                    >
                      {copiedCmd === runCmd ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    </button>
                  </div>
                </div>
                {m.score_components && (
                  <div className="rounded border border-zinc-800 bg-zinc-950 p-3 text-xs">
                    <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                      Score Breakdown
                    </h4>
                    <ScoreBar label="Quality" value={m.score_components.quality} />
                    <ScoreBar label="Speed" value={m.score_components.speed} />
                    <ScoreBar label="Fit" value={m.score_components.fit} />
                    <ScoreBar label="Context" value={m.score_components.context} />
                  </div>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="w-14 text-zinc-500">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full rounded-full bg-cyan-500/60 transition-all duration-500"
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="mono w-7 text-right text-zinc-400">{value.toFixed(0)}</span>
    </div>
  )
}
