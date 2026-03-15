import { useEffect, useState } from 'react'
import type { SystemData, FitData, HardwareOverride } from '../lib/types'
import { ModelExplorer } from './ModelExplorer'
import { AgentFore } from './AgentFore'
import { Documentation } from './Documentation'
import { RefreshCw, Minus, Square, X, BookOpen, Layers, Bot, Home, Sun, Moon, Monitor } from 'lucide-react'

type MainView = 'explorer' | 'agent'

const THEME_KEY = 'forellm-theme'
type ThemeMode = 'dark' | 'light' | 'system'

function getEffectiveTheme(mode: ThemeMode): 'dark' | 'light' {
  if (mode === 'system') {
    return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  }
  return mode
}

function applyTheme(mode: 'dark' | 'light') {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('dark', mode === 'dark')
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
  loading: boolean
  loadingFullList?: boolean
  simulating: boolean
  contextLength: number
  hardwareOverride: HardwareOverride | null
  runnableCountDetected: number | null
  onSimulate: (override: HardwareOverride | null) => void
  onContextChange: (ctx: number) => void
  onRefresh: () => void
  onBackToLauncher?: () => void
}

export function Dashboard({
  systemData,
  fitData,
  loading,
  loadingFullList,
  simulating,
  contextLength,
  hardwareOverride,
  runnableCountDetected,
  onSimulate,
  onContextChange,
  onRefresh,
  onBackToLauncher
}: Props) {
  const [isMaximized, setIsMaximized] = useState(false)
  const [docsOpen, setDocsOpen] = useState(false)
  const [mainView, setMainView] = useState<MainView>('explorer')
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    if (typeof localStorage === 'undefined') return 'dark'
    return (localStorage.getItem(THEME_KEY) as ThemeMode) || 'dark'
  })

  useEffect(() => {
    if (typeof window !== 'undefined' && window.forellm) {
      window.forellm.isMaximized().then(setIsMaximized)
      window.forellm.onWindowMaximizedChange(setIsMaximized)
    }
  }, [])

  useEffect(() => {
    const effective = getEffectiveTheme(themeMode)
    applyTheme(effective)
  }, [themeMode])

  useEffect(() => {
    if (themeMode !== 'system') return
    const mq = window.matchMedia?.('(prefers-color-scheme: light)')
    const handler = () => applyTheme(getEffectiveTheme('system'))
    mq?.addEventListener?.('change', handler)
    return () => mq?.removeEventListener?.('change', handler)
  }, [themeMode])

  function cycleTheme() {
    const next: ThemeMode = themeMode === 'dark' ? 'light' : themeMode === 'light' ? 'system' : 'dark'
    setThemeMode(next)
    localStorage.setItem(THEME_KEY, next)
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden rounded-xl bg-white dark:bg-zinc-950">
      {docsOpen && <Documentation onClose={() => setDocsOpen(false)} />}
      {/* Title bar */}
      <header className="flex h-10 shrink-0 items-center justify-between rounded-t-xl border-b border-zinc-200 bg-zinc-100 px-4 dark:border-zinc-800 dark:bg-zinc-900/80 [-webkit-app-region:drag]">
        <div className="flex items-center gap-2 [-webkit-app-region:no-drag]">
          {onBackToLauncher && (
            <button
              onClick={onBackToLauncher}
              className="rounded p-1.5 text-zinc-500 transition hover:bg-zinc-200 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              title="Back to launcher"
            >
              <Home className="h-4 w-4" />
            </button>
          )}
          <span className="text-sm font-semibold tracking-wide text-zinc-800 dark:text-zinc-200">
            ForeLLM
          </span>
          <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] text-emerald-400">
            v0.32.2026
          </span>
        </div>
        <div className="flex items-center gap-0.5 [-webkit-app-region:no-drag]">
          {loadingFullList && (
            <span className="text-[10px] text-cyan-600 dark:text-cyan-500/90">Loading full list (may take 1–2 min)…</span>
          )}
          <button
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-zinc-600 transition hover:bg-zinc-200 hover:text-zinc-900 disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Loading…' : 'Refresh'}
          </button>
          <button
            onClick={() => setDocsOpen(true)}
            className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-zinc-600 transition hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            title="Documentation"
          >
            <BookOpen className="h-3 w-3" />
            Docs
          </button>
          <button
            type="button"
            onClick={cycleTheme}
            className="rounded p-1.5 text-zinc-600 transition hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            title={themeMode === 'dark' ? 'Dark' : themeMode === 'light' ? 'Light' : 'System'}
          >
            {themeMode === 'dark' && <Moon className="h-4 w-4" />}
            {themeMode === 'light' && <Sun className="h-4 w-4" />}
            {themeMode === 'system' && <Monitor className="h-4 w-4" />}
          </button>
          {typeof window !== 'undefined' && window.forellm && (
            <>
              <button
                onClick={() => window.forellm.minimize()}
                className="rounded p-1.5 text-zinc-500 transition hover:bg-zinc-200 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                title="Minimize"
              >
                <Minus className="h-4 w-4" />
              </button>
              <button
                onClick={() => window.forellm.maximize()}
                className="rounded p-1.5 text-zinc-500 transition hover:bg-zinc-200 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
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
                className="rounded p-1.5 text-zinc-500 transition hover:bg-red-500/20 hover:text-red-400"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </header>

      {/* Main layout */}
      <div className="flex min-h-0 flex-1 flex-col gap-px bg-zinc-200 dark:bg-zinc-800/50">
        <div className="flex min-h-0 flex-1">
          {/* Main content: Model Explorer or Agent Fore */}
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-zinc-50 dark:bg-zinc-950">
            {/* Top bar: Model Explorer | Agent Fore */}
            <div className="flex shrink-0 items-center gap-1 border-b border-zinc-200 px-3 py-1.5 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setMainView('explorer')}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wider transition ${
                  mainView === 'explorer'
                    ? 'bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200'
                    : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-500 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-300'
                }`}
              >
                <Layers className="h-3.5 w-3.5 text-cyan-500 dark:text-cyan-400" />
                Model Explorer
              </button>
              <button
                type="button"
                onClick={() => setMainView('agent')}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wider transition ${
                  mainView === 'agent'
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                    : 'text-zinc-600 hover:bg-zinc-100 hover:text-emerald-600 dark:text-zinc-500 dark:hover:bg-zinc-800/60 dark:hover:text-emerald-400/90'
                }`}
                title="AI agent with system specs and model knowledge"
              >
                <Bot className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
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

      </div>
    </div>
  )
}
