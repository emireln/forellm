import { useState, useEffect, useCallback, useRef } from 'react'
import { Dashboard } from './components/Dashboard'
import { Launcher } from './components/Launcher'
import type { SystemData, FitData, ModelFit, HardwareOverride } from './lib/types'
import { AlertTriangle, RefreshCw, Terminal } from 'lucide-react'

export default function App() {
  const [showLauncher, setShowLauncher] = useState(true)
  const [systemData, setSystemData] = useState<SystemData | null>(null)
  const [fitData, setFitData] = useState<FitData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hardwareOverride, setHardwareOverride] = useState<HardwareOverride | null>(null)
  const [contextLength, setContextLength] = useState(4096)
  const [runnableCountDetected, setRunnableCountDetected] = useState<number | null>(null)
  const [loadingFullList, setLoadingFullList] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)

  const normalizeFit = useCallback((fit: FitData | null) => {
    if (!fit?.models) return fit
    fit.models = fit.models.map((m) => ({
      ...m,
      fit_level: (m.fit_level as string) === 'Too Tight' ? 'TooTight' : m.fit_level
    }))
    return fit
  }, [])

  /** Full fetch: system + fit (optional limit). Used for refresh/simulate/context. */
  const fetchData = useCallback(
    async (override?: HardwareOverride | null, maxContext?: number, opts?: { limit?: number }) => {
      const fitOpts = {
        memory: override?.memory,
        ram: override?.ram,
        cores: override?.cores,
        maxContext: maxContext || undefined,
        limit: opts?.limit
      }
      try {
        setLoading(true)
        setError(null)
        if (opts?.limit) setLoadingFullList(true)

        const [sys, fit] = await Promise.all([
          window.forellm.getSystem() as Promise<SystemData>,
          window.forellm.getFit(fitOpts) as Promise<FitData>
        ])

        const normalized = normalizeFit(fit ?? null)
        setSystemData(sys)
        setFitData(normalized)
        if (!override && normalized?.models) {
          setRunnableCountDetected(normalized.models.filter((m) => m.fit_level !== 'TooTight').length)
        }
        setLoading(false)

        if (opts?.limit && normalized?.models) {
          const fullFit = await (window.forellm.getFit({
            memory: override?.memory,
            ram: override?.ram,
            cores: override?.cores,
            maxContext: maxContext || undefined
          }) as Promise<FitData>)
          const fullNormalized = normalizeFit(fullFit ?? null)
          setFitData(fullNormalized)
          if (!override && fullNormalized?.models) {
            setRunnableCountDetected(fullNormalized.models.filter((m) => m.fit_level !== 'TooTight').length)
          }
          setLoadingFullList(false)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
        setLoading(false)
        setLoadingFullList(false)
      }
    },
    [normalizeFit]
  )

  /** Ultrafast initial load: system only → 30 models → full list after delay. No parallel heavy work. */
  useEffect(() => {
    let cancelled = false
    const baseOpts = {
      memory: undefined as string | undefined,
      ram: undefined as string | undefined,
      cores: undefined as number | undefined,
      maxContext: undefined as number | undefined
    }

    async function run() {
      try {
        setError(null)
        setLoading(true)

        // 1) System only (small, fast) – dashboard can show hardware
        const sys = await (window.forellm.getSystem() as Promise<SystemData>)
        if (cancelled) return
        setSystemData(sys)
        setLoading(false)

        // 2) Tiny first batch (30 models) – table appears fast
        const fitSmall = await (window.forellm.getFit({
          ...baseOpts,
          limit: 30
        }) as Promise<FitData>)
        if (cancelled) return
        const normSmall = normalizeFit(fitSmall ?? null)
        setFitData(normSmall)
        if (normSmall?.models) {
          setRunnableCountDetected(normSmall.models.filter((m) => m.fit_level !== 'TooTight').length)
        }
        setLoadingFullList(true)

        // 3) Full list after delay so UI stays responsive (no back-to-back heavy work)
        await new Promise((r) => setTimeout(r, 1500))
        if (cancelled) return
        const fullFit = await (window.forellm.getFit(baseOpts) as Promise<FitData>)
        if (cancelled) return
        const fullNorm = normalizeFit(fullFit ?? null)
        setFitData(fullNorm)
        if (fullNorm?.models) {
          setRunnableCountDetected(fullNorm.models.filter((m) => m.fit_level !== 'TooTight').length)
        }
        setLoadingFullList(false)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
          setLoading(false)
          setLoadingFullList(false)
        }
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [normalizeFit])

  const handleSimulate = useCallback(
    (override: HardwareOverride | null) => {
      setHardwareOverride(override)
      fetchData(override, contextLength, { limit: 50 })
    },
    [fetchData, contextLength]
  )

  const handleContextChange = useCallback(
    (ctx: number) => {
      setContextLength(ctx)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        fetchData(hardwareOverride, ctx, { limit: 50 })
      }, 400)
    },
    [fetchData, hardwareOverride]
  )

  const onRefresh = useCallback(
    () => fetchData(hardwareOverride, contextLength, { limit: 50 }),
    [fetchData, hardwareOverride, contextLength]
  )

  if (showLauncher) {
    return <Launcher onOpenGui={() => setShowLauncher(false)} />
  }

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
          {error.toLowerCase().includes('timed out') && (
            <p className="text-sm text-amber-200/90">
              The <strong>forellm</strong> CLI is installed but responding slowly (e.g. first run or antivirus). Click <strong>Retry</strong> — the next attempt waits up to 1 minute.
            </p>
          )}
          <div className="flex items-center gap-3 rounded border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-500">
            <Terminal className="h-4 w-4 shrink-0 text-zinc-600" />
            <span>
              The GUI needs the <strong>forellm</strong> CLI: install it (<code className="text-cyan-400">scoop install forellm</code> / <code className="text-cyan-400">brew install forellm</code>) or set <code className="text-cyan-400">FORELLM_PATH</code> to the binary. From source: <code className="text-cyan-400">cargo build --release</code>.
            </span>
          </div>
          <button
            onClick={() => {
              setError(null)
              fetchData(undefined, undefined, { limit: 50 })
            }}
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
      loading={loading}
      loadingFullList={loadingFullList}
      simulating={hardwareOverride != null}
      contextLength={contextLength}
      hardwareOverride={hardwareOverride}
      runnableCountDetected={runnableCountDetected}
      onSimulate={handleSimulate}
      onContextChange={handleContextChange}
      onRefresh={onRefresh}
      onBackToLauncher={() => setShowLauncher(true)}
    />
  )
}
