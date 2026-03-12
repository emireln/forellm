import { useState, useEffect, useCallback, useRef } from 'react'
import { Dashboard } from './components/Dashboard'
import type { SystemData, FitData, ModelFit, CartItem } from './lib/types'
import { AlertTriangle, RefreshCw, Terminal } from 'lucide-react'

export default function App() {
  const [systemData, setSystemData] = useState<SystemData | null>(null)
  const [fitData, setFitData] = useState<FitData | null>(null)
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [memoryOverride, setMemoryOverride] = useState<string | null>(null)
  const [contextLength, setContextLength] = useState(4096)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)

  const fetchData = useCallback(
    async (memory?: string | null, maxContext?: number) => {
      try {
        setLoading(true)
        setError(null)

        const [sys, fit] = await Promise.all([
          window.forellm.getSystem() as Promise<SystemData>,
          window.forellm.getFit({
            memory: memory || undefined,
            maxContext: maxContext || undefined
          }) as Promise<FitData>
        ])

        setSystemData(sys)
        setFitData(fit)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    },
    []
  )

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSimulate = useCallback(
    (memory: string | null) => {
      setMemoryOverride(memory)
      fetchData(memory, contextLength)
    },
    [fetchData, contextLength]
  )

  const handleContextChange = useCallback(
    (ctx: number) => {
      setContextLength(ctx)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        fetchData(memoryOverride, ctx)
      }, 400)
    },
    [fetchData, memoryOverride]
  )

  const addToCart = useCallback((model: ModelFit) => {
    setCartItems((prev) => {
      if (prev.some((i) => i.model.name === model.name)) return prev
      return [...prev, { model, id: crypto.randomUUID() }]
    })
  }, [])

  const removeFromCart = useCallback((id: string) => {
    setCartItems((prev) => prev.filter((i) => i.id !== id))
  }, [])

  const clearCart = useCallback(() => setCartItems([]), [])

  if (error) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-zinc-950 p-8">
        <div className="panel max-w-lg space-y-4 p-6">
          <div className="flex items-center gap-3 text-red-400">
            <AlertTriangle className="h-6 w-6 shrink-0" />
            <h2 className="text-lg font-semibold">Connection Error</h2>
          </div>
          <pre className="whitespace-pre-wrap rounded border border-zinc-800 bg-zinc-950 p-4 font-mono text-xs text-zinc-400">
            {error}
          </pre>
          <div className="flex items-center gap-3 rounded border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-500">
            <Terminal className="h-4 w-4 shrink-0 text-zinc-600" />
            <span>
              Build the CLI first:{' '}
              <code className="text-cyan-400">cargo build --release</code>
            </span>
          </div>
          <button
            onClick={() => fetchData()}
            className="flex items-center gap-2 rounded border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-zinc-200 transition hover:bg-zinc-700"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <Dashboard
      systemData={systemData}
      fitData={fitData}
      cartItems={cartItems}
      loading={loading}
      simulating={memoryOverride !== null}
      contextLength={contextLength}
      memoryOverride={memoryOverride}
      onSimulate={handleSimulate}
      onContextChange={handleContextChange}
      onAddToCart={addToCart}
      onRemoveFromCart={removeFromCart}
      onClearCart={clearCart}
      onRefresh={() => fetchData(memoryOverride, contextLength)}
    />
  )
}
