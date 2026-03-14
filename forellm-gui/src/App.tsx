import { useState, useEffect, useCallback, useRef } from 'react'
import { Dashboard } from './components/Dashboard'
import type { SystemData, FitData, ModelFit, CartItem, HardwareOverride } from './lib/types'
import { AlertTriangle, RefreshCw, Terminal } from 'lucide-react'

export default function App() {
  const [systemData, setSystemData] = useState<SystemData | null>(null)
  const [fitData, setFitData] = useState<FitData | null>(null)
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hardwareOverride, setHardwareOverride] = useState<HardwareOverride | null>(null)
  const [contextLength, setContextLength] = useState(4096)
  const [runnableCountDetected, setRunnableCountDetected] = useState<number | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)

  const fetchData = useCallback(
    async (override?: HardwareOverride | null, maxContext?: number) => {
      try {
        setLoading(true)
        setError(null)

        const [sys, fit] = await Promise.all([
          window.forellm.getSystem() as Promise<SystemData>,
          window.forellm.getFit({
            memory: override?.memory,
            ram: override?.ram,
            cores: override?.cores,
            maxContext: maxContext || undefined
          }) as Promise<FitData>
        ])

        // CLI JSON sends fit_level as "Too Tight"; normalize to "TooTight" so counts and badges work
        if (fit?.models) {
          fit.models = fit.models.map((m) => ({
            ...m,
            fit_level: (m.fit_level as string) === 'Too Tight' ? 'TooTight' : m.fit_level
          }))
        }

        setSystemData(sys)
        setFitData(fit)
        if (!override && fit?.models) {
          setRunnableCountDetected(fit.models.filter((m) => m.fit_level !== 'TooTight').length)
        }
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
    (override: HardwareOverride | null) => {
      setHardwareOverride(override)
      fetchData(override, contextLength)
    },
    [fetchData, contextLength]
  )

  const handleContextChange = useCallback(
    (ctx: number) => {
      setContextLength(ctx)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        fetchData(hardwareOverride, ctx)
      }, 400)
    },
    [fetchData, hardwareOverride]
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

  const onRefresh = useCallback(
    () => fetchData(hardwareOverride, contextLength),
    [fetchData, hardwareOverride, contextLength]
  )

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
      simulating={hardwareOverride != null}
      contextLength={contextLength}
      hardwareOverride={hardwareOverride}
      runnableCountDetected={runnableCountDetected}
      onSimulate={handleSimulate}
      onContextChange={handleContextChange}
      onAddToCart={addToCart}
      onRemoveFromCart={removeFromCart}
      onClearCart={clearCart}
      onRefresh={onRefresh}
    />
  )
}
