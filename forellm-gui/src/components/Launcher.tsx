import { useState, useEffect } from 'react'
import { Bot, Terminal, LayoutDashboard, Minus, Square, X, BookOpen, ChevronDown, ChevronRight, Copy } from 'lucide-react'

/** Windows-style "restore down" icon for title bar */
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

interface LauncherProps {
  onOpenGui: () => void
}

export function Launcher({ onOpenGui }: LauncherProps) {
  const [isMaximized, setIsMaximized] = useState(false)
  const [runAgentAvailable, setRunAgentAvailable] = useState(true)
  const [runCliHint, setRunCliHint] = useState<string | undefined>(undefined)
  const [launcherError, setLauncherError] = useState<string | null>(null)
  const [cliCommand, setCliCommand] = useState<string | null>(null)
  const [copyDone, setCopyDone] = useState(false)
  const [tutorialCliOpen, setTutorialCliOpen] = useState(false)
  const [tutorialAgentOpen, setTutorialAgentOpen] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && window.forellm) {
      window.forellm.isMaximized().then(setIsMaximized)
      window.forellm.onWindowMaximizedChange(setIsMaximized)
      window.forellm.getLauncherCapabilities?.().then((c) => {
        if (c) {
          setRunAgentAvailable(c.runAgentAvailable)
          setRunCliHint(c.runCliHint)
        }
      })
    }
  }, [])

  const handleRunAgent = async () => {
    setLauncherError(null)
    const res = await window.forellm?.launchAgent?.()
    if (res && !res.ok && res.error) setLauncherError(res.error)
  }

  const handleRunCli = async () => {
    setLauncherError(null)
    setCliCommand(null)
    setCopyDone(false)
    const res = await window.forellm?.launchCli?.()
    if (!res) return
    if (!res.ok && res.error) {
      setLauncherError(res.error)
      return
    }
    if (res.ok && res.command) setCliCommand(res.command)
  }

  const copyCliCommand = async () => {
    if (!cliCommand) return
    try {
      await navigator.clipboard.writeText(cliCommand)
      setCopyDone(true)
      setTimeout(() => setCopyDone(false), 2000)
    } catch {
      setLauncherError('Could not copy to clipboard')
    }
  }

  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden rounded-xl">
      {/* Website-style gradient fading background */}
      <div className="launcher-bg-wrap" aria-hidden="true">
        <div className="launcher-bg-base" />
        <div className="launcher-bg-grid" />
        <div className="launcher-bg-neon">
          <div className="blob blob-1" />
          <div className="blob blob-2" />
          <div className="blob blob-3" />
          <div className="blob blob-4" />
          <div className="blob blob-5" />
        </div>
      </div>

      {/* Title bar with window controls */}
      <header className="relative z-[1] flex h-10 shrink-0 items-center justify-between rounded-t-xl border-b border-zinc-200 bg-white/80 px-4 dark:border-zinc-800 dark:bg-zinc-900/50 [-webkit-app-region:drag]">
        <div className="flex items-center gap-2 [-webkit-app-region:no-drag]">
          <span className="text-sm font-semibold tracking-wide text-zinc-800 dark:text-zinc-200">
            ForeLLM
          </span>
          <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] text-emerald-600 dark:text-emerald-400">
            Launcher
          </span>
        </div>
        <div className="flex items-center gap-0.5 [-webkit-app-region:no-drag]">
          {typeof window !== 'undefined' && window.forellm && (
            <>
              <button
                type="button"
                onClick={() => window.forellm.minimize()}
                className="rounded p-1.5 text-zinc-500 transition hover:bg-zinc-200 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                title="Minimize"
              >
                <Minus className="h-4 w-4" />
              </button>
              <button
                type="button"
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
                type="button"
                onClick={() => window.forellm.close()}
                className="rounded p-1.5 text-zinc-500 transition hover:bg-red-500/20 hover:text-red-500 dark:text-zinc-400 dark:hover:text-red-400"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </header>

      <div className="relative z-[1] flex flex-1 flex-col items-center justify-center p-8">
      <div className="mb-10 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          ForeLLM
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-500">
          Choose how to run ForeLLM
        </p>
      </div>

      <div className="grid w-full max-w-2xl grid-cols-1 gap-4 sm:grid-cols-3">
        <button
          type="button"
          onClick={onOpenGui}
          className="flex flex-col items-center gap-4 rounded-xl border border-zinc-300 bg-white/90 p-6 text-left shadow-sm transition hover:border-emerald-500/50 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 dark:border-zinc-800 dark:bg-zinc-900/80 dark:hover:border-emerald-600/50 dark:hover:bg-zinc-800/80"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <LayoutDashboard className="h-6 w-6" />
          </div>
          <div className="w-full">
            <span className="block font-semibold text-zinc-800 dark:text-zinc-200">
              Open ForeLLM GUI
            </span>
            <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-500">
              Model Explorer & Agent in this window
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={handleRunAgent}
          disabled={!runAgentAvailable}
          title={!runAgentAvailable ? 'Only available when running from source (npm run dev)' : undefined}
          className={`flex flex-col items-center gap-4 rounded-xl border border-zinc-300 bg-white/90 p-6 text-left shadow-sm transition focus:outline-none focus:ring-2 focus:ring-amber-500/40 dark:border-zinc-800 dark:bg-zinc-900/80 ${
            runAgentAvailable
              ? 'hover:border-amber-500/50 hover:bg-zinc-50 dark:hover:border-amber-600/50 dark:hover:bg-zinc-800/80'
              : 'cursor-not-allowed opacity-60'
          }`}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Bot className="h-6 w-6" />
          </div>
          <div className="w-full">
            <span className="block font-semibold text-zinc-800 dark:text-zinc-200">
              Run Agent in Terminal
            </span>
            <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-500">
              {runAgentAvailable ? 'Agent Fore CLI in a new terminal' : 'Only when running from source (npm run dev)'}
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={handleRunCli}
          className="flex flex-col items-center gap-4 rounded-xl border border-zinc-300 bg-white/90 p-6 text-left shadow-sm transition hover:border-cyan-500/50 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 dark:border-zinc-800 dark:bg-zinc-900/80 dark:hover:border-cyan-600/50 dark:hover:bg-zinc-800/80"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
            <Terminal className="h-6 w-6" />
          </div>
          <div className="w-full">
            <span className="block font-semibold text-zinc-800 dark:text-zinc-200">
              Run ForeLLM CLI
            </span>
            <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-500">
              Copy command and run in your terminal
            </span>
            {runCliHint && (
              <span className="mt-1 block text-[10px] text-cyan-600/80 dark:text-cyan-400/80">
                {runCliHint}
              </span>
            )}
          </div>
        </button>
      </div>

      {cliCommand && (
        <div className="mt-4 flex w-full max-w-2xl flex-col items-center gap-2 rounded-lg border border-cyan-200 bg-cyan-50/80 px-4 py-3 dark:border-cyan-800/60 dark:bg-cyan-950/30">
          <span className="text-xs text-zinc-600 dark:text-zinc-400">Run this in a terminal (cmd or PowerShell):</span>
          <div className="flex w-full items-center gap-2">
            <code className="flex-1 truncate rounded bg-white px-3 py-2 text-sm text-cyan-800 dark:bg-zinc-900 dark:text-cyan-200">
              {cliCommand}
            </code>
            <button
              type="button"
              onClick={copyCliCommand}
              className="flex shrink-0 items-center gap-1.5 rounded border border-cyan-300 bg-cyan-100 px-3 py-2 text-xs font-medium text-cyan-700 transition hover:bg-cyan-200 dark:border-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-200 dark:hover:bg-cyan-800/50"
            >
              <Copy className="h-3.5 w-3.5" />
              {copyDone ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      {launcherError && (
        <p className="mt-4 max-w-md text-center text-xs text-amber-600 dark:text-amber-400">
          {launcherError}
        </p>
      )}

      <p className="mt-6 max-w-md text-center text-xs text-zinc-500 dark:text-zinc-600">
        Agent and CLI open in a separate terminal window.
      </p>

      {/* Tutorials */}
      <div className="mt-6 w-full max-w-2xl space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-500">
          <BookOpen className="h-3.5 w-3.5" />
          Tutorials
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white/80 dark:border-zinc-800 dark:bg-zinc-900/60">
          <button
            type="button"
            onClick={() => setTutorialCliOpen((o) => !o)}
            className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-zinc-800 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800/50"
          >
            {tutorialCliOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            How to run ForeLLM CLI (Rust TUI)
          </button>
          {tutorialCliOpen && (
            <div className="border-t border-zinc-200 px-4 pb-4 pt-2 text-xs text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
              <ol className="list-decimal space-y-1.5 pl-4">
                <li>Install the Rust <code className="rounded bg-zinc-200 px-1 font-mono text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">forellm</code> CLI: from the repo root run <code className="rounded bg-zinc-200 px-1 font-mono text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">cargo build --release</code>, or install via <code className="rounded bg-zinc-200 px-1 font-mono text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">scoop install forellm</code> / <code className="rounded bg-zinc-200 px-1 font-mono text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">brew install forellm</code>.</li>
                <li>Either add the <code className="rounded bg-zinc-200 px-1 font-mono text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">forellm</code> binary to your system PATH, or set the <code className="rounded bg-zinc-200 px-1 font-mono text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">FORELLM_PATH</code> environment variable to the full path of <code className="rounded bg-zinc-200 px-1 font-mono text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">forellm.exe</code> (e.g. <code className="rounded bg-zinc-200 px-1 font-mono text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">C:\...\target\release\forellm.exe</code>).</li>
                <li>In the installed app, click <strong className="text-zinc-700 dark:text-zinc-300">Run ForeLLM CLI</strong>; a new terminal will open with the TUI. When running from source (<code className="rounded bg-zinc-200 px-1 font-mono text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">npm run dev</code>), the button uses the binary next to the project automatically.</li>
              </ol>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white/80 dark:border-zinc-800 dark:bg-zinc-900/60">
          <button
            type="button"
            onClick={() => setTutorialAgentOpen((o) => !o)}
            className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-zinc-800 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800/50"
          >
            {tutorialAgentOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            How to run Agent in Terminal
          </button>
          {tutorialAgentOpen && (
            <div className="border-t border-zinc-200 px-4 pb-4 pt-2 text-xs text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
              <ol className="list-decimal space-y-1.5 pl-4">
                <li><strong className="text-zinc-700 dark:text-zinc-300">Only when running from source:</strong> Start the app with <code className="rounded bg-zinc-200 px-1 font-mono text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">npm run dev</code> from the <code className="rounded bg-zinc-200 px-1 font-mono text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">forellm-gui</code> folder (not the installed app).</li>
                <li>Click <strong className="text-zinc-700 dark:text-zinc-300">Run Agent in Terminal</strong>; a new terminal opens and runs <code className="rounded bg-zinc-200 px-1 font-mono text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">npm run agent</code> (Agent Fore CLI with the same chat and tools as the in-app Agent tab).</li>
                <li>Or from a terminal: <code className="rounded bg-zinc-200 px-1 font-mono text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">cd forellm-gui && npm run agent</code>. You need Node.js, the <code className="rounded bg-zinc-200 px-1 font-mono text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">forellm</code> binary, and <a href="https://ollama.com" target="_blank" rel="noopener noreferrer" className="text-cyan-600 hover:underline dark:text-cyan-400">Ollama</a> running. Type <code className="rounded bg-zinc-200 px-1 font-mono text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">/help</code> in the chat for commands.</li>
              </ol>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  )
}
