import { X } from 'lucide-react'

interface Props {
  onClose: () => void
}

export function Documentation({ onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-12 pb-12 dark:bg-black/70"
      role="dialog"
      aria-modal="true"
      aria-label="App documentation"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl overflow-hidden rounded-xl border border-zinc-300 bg-white shadow-2xl dark:border-zinc-700/80 dark:bg-zinc-950"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-xl border-b border-zinc-200 bg-zinc-50/95 px-4 py-3 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/95">
          <h1 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            ForeLLM Desktop GUI — Documentation
          </h1>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-zinc-500 transition hover:bg-zinc-200 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
            aria-label="Close documentation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[calc(90vh-4rem)] overflow-y-auto px-5 py-6 text-sm text-zinc-600 scrollbar-thin dark:text-zinc-300">
          <section className="mb-6">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-500">
              Overview
            </h2>
            <p className="leading-relaxed text-zinc-700 dark:text-inherit">
              The GUI is a visual dashboard that runs the <strong className="text-zinc-800 dark:text-zinc-200">forellm</strong> CLI under the hood. It lets you browse and score models and run download commands from inside the app.
            </p>
            <p className="mt-2 leading-relaxed text-zinc-700 dark:text-inherit">
              <strong className="text-zinc-800 dark:text-zinc-200">Tech:</strong> Electron (main process), React + Tailwind (renderer), IPC to invoke <code className="rounded bg-zinc-200 px-1 font-mono text-emerald-700 dark:bg-zinc-800 dark:text-emerald-400">forellm</code> for <code className="rounded bg-zinc-200 px-1 font-mono text-emerald-700 dark:bg-zinc-800 dark:text-emerald-400">system</code>, <code className="rounded bg-zinc-200 px-1 font-mono text-emerald-700 dark:bg-zinc-800 dark:text-emerald-400">fit</code>, and <code className="rounded bg-zinc-200 px-1 font-mono text-emerald-700 dark:bg-zinc-800 dark:text-emerald-400">download</code>.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-500">
              Requirements & running
            </h2>
            <ul className="list-inside list-disc space-y-1 text-zinc-600 dark:text-zinc-400">
              <li><strong className="text-zinc-700 dark:text-zinc-300">ForeLLM CLI</strong> must be built first: <code className="rounded bg-zinc-200 px-1 font-mono text-emerald-700 dark:bg-zinc-800 dark:text-emerald-400">cargo build --release</code> (from repo root).</li>
              <li><strong className="text-zinc-700 dark:text-zinc-300">Node.js</strong> and npm for the GUI.</li>
              <li>Optional: set <code className="rounded bg-zinc-200 px-1 font-mono text-emerald-700 dark:bg-zinc-800 dark:text-emerald-400">FORELLM_PATH</code> to the full path of the <code className="rounded bg-zinc-200 px-1 font-mono text-emerald-700 dark:bg-zinc-800 dark:text-emerald-400">forellm</code> binary.</li>
            </ul>
            <pre className="mt-3 rounded-lg border border-zinc-200 bg-zinc-100 p-3 font-mono text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-400">
{`# From repo root
cargo build --release
cd forellm-gui
npm install
npm run dev`}
            </pre>
          </section>

          <section className="mb-6">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-500">
              Title bar
            </h2>
            <ul className="space-y-1.5 text-zinc-600 dark:text-zinc-400">
              <li><strong className="text-zinc-700 dark:text-zinc-300">ForeLLM</strong> — App name and version badge.</li>
              <li><strong className="text-zinc-700 dark:text-zinc-300">Theme</strong> — Toggle dark / light / system (cycle: Moon, Sun, Monitor).</li>
              <li><strong className="text-zinc-700 dark:text-zinc-300">Refresh</strong> — Re-runs hardware detection and fit; reloads the model list.</li>
              <li><strong className="text-zinc-700 dark:text-zinc-300">Docs</strong> — Opens this documentation.</li>
              <li><strong className="text-zinc-700 dark:text-zinc-300">Window controls</strong> — Minimize, Maximize/Restore, Close (Electron).</li>
            </ul>
            <p className="mt-2 text-zinc-500 dark:text-zinc-500">The title bar is draggable for moving the window.</p>
          </section>

          <section className="mb-6">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-500">
              Model Explorer
            </h2>
            <p className="mb-3 leading-relaxed text-zinc-600 dark:text-zinc-400">
              Main content: sortable table of models with per-row actions (copy, download, link to Hugging Face).
            </p>

            <h3 className="mb-1.5 font-medium text-zinc-800 dark:text-zinc-200">Toolbar</h3>
            <ul className="mb-3 list-inside list-disc space-y-1 text-zinc-600 dark:text-zinc-400">
              <li><strong className="text-zinc-700 dark:text-zinc-300">Model Explorer</strong> label and model count.</li>
              <li><strong className="text-zinc-700 dark:text-zinc-300">Search</strong> — Filter by name, provider, use case, params.</li>
              <li><strong className="text-zinc-700 dark:text-zinc-300">Context</strong> — Slider (2k–128k); affects memory and fit; data re-fetched with selected cap.</li>
            </ul>

            <h3 className="mb-1.5 font-medium text-zinc-800 dark:text-zinc-200">Model table & Actions</h3>
            <ul className="list-inside list-disc space-y-1 text-zinc-600 dark:text-zinc-400">
              <li><strong className="text-zinc-700 dark:text-zinc-300">Columns:</strong> Expand, Model, Provider, Params, Quant, Mem Req, Score, Tok/s, Fit, Use Case, Actions.</li>
              <li><strong className="text-zinc-700 dark:text-zinc-300">Sort</strong> — Click headers (Params, Mem Req, Score, Tok/s); click again to toggle order.</li>
              <li><strong className="text-zinc-700 dark:text-zinc-300">Expand row</strong> — Chevron shows quantization matrix and copy-run-command button.</li>
              <li><strong className="text-zinc-700 dark:text-zinc-300">Copy</strong> — Copies the run command: <code className="rounded bg-zinc-200 px-1 font-mono text-emerald-700 dark:bg-zinc-800 dark:text-emerald-400">ollama run &lt;tag&gt;</code> or <code className="rounded bg-zinc-200 px-1 font-mono text-emerald-700 dark:bg-zinc-800 dark:text-emerald-400">forellm download &quot;&lt;model&gt;&quot;</code>. Shown only when the model fits (not TooTight).</li>
              <li><strong className="text-zinc-700 dark:text-zinc-300">Download</strong> — Runs <code className="rounded bg-zinc-200 px-1 font-mono text-emerald-700 dark:bg-zinc-800 dark:text-emerald-400">forellm download</code> for that model. Disabled when the model does not fit (TooTight) or while a download is in progress. Only GGUF repos are supported.</li>
              <li><strong className="text-zinc-700 dark:text-zinc-300">Hugging Face</strong> — Link icon opens the model card on Hugging Face in your browser.</li>
            </ul>
            <p className="mt-2 text-zinc-500 dark:text-zinc-500">Fit badges (Perfect, Good, Marginal, TooTight) show how well the model fits your hardware.</p>
          </section>

          <section className="mb-6">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-500">
              Agent Fore
            </h2>
            <p className="mb-2 leading-relaxed text-zinc-600 dark:text-zinc-400">
              Chat with agents (General, Data Analyst, Web Researcher, Coding Expert) using Ollama or OpenClaw. Conversations are <strong className="text-zinc-700 dark:text-zinc-300">auto-saved</strong> to the browser; they persist when you close the app or switch tabs. Controls (Export, Agent, Backend, Model, New chat, etc.) live in a <strong className="text-zinc-700 dark:text-zinc-300">floating island</strong> at the top—click &quot;Controls&quot; to open it, click outside to close.
            </p>
            <p className="mb-2 leading-relaxed text-zinc-600 dark:text-zinc-400">
              <strong className="text-zinc-700 dark:text-zinc-300">Export chat</strong> — Use <strong className="text-zinc-700 dark:text-zinc-300">Export</strong> in the island to download the current conversation as Markdown or TXT (clean or with tool calls).
            </p>
          </section>

          <section className="mb-6">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-500">
              Download command (CLI)
            </h2>
            <p className="mb-2 leading-relaxed text-zinc-600 dark:text-zinc-400">
              The GUI runs <code className="rounded bg-zinc-200 px-1 font-mono text-emerald-700 dark:bg-zinc-800 dark:text-emerald-400">forellm download &lt;model&gt; [--quant X] [--list]</code> via IPC. Model can be a HuggingFace repo ID, a search query, or a known short name. Only repos with <strong className="text-zinc-700 dark:text-zinc-300">GGUF</strong> files work; use <code className="rounded bg-zinc-200 px-1 font-mono text-emerald-700 dark:bg-zinc-800 dark:text-emerald-400">forellm hf-search &lt;query&gt;</code> in a terminal to find GGUF models.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-500">
              Environment
            </h2>
            <p className="leading-relaxed text-zinc-600 dark:text-zinc-400">
              <code className="rounded bg-zinc-200 px-1 font-mono text-emerald-700 dark:bg-zinc-800 dark:text-emerald-400">FORELLM_PATH</code> — Full path to the <code className="rounded bg-zinc-200 px-1 font-mono text-emerald-700 dark:bg-zinc-800 dark:text-emerald-400">forellm</code> binary. If unset, the app uses <code className="rounded bg-zinc-200 px-1 font-mono text-emerald-700 dark:bg-zinc-800 dark:text-emerald-400">../target/release/forellm</code> or <code className="rounded bg-zinc-200 px-1 font-mono text-emerald-700 dark:bg-zinc-800 dark:text-emerald-400">../target/debug/forellm</code>.
            </p>
          </section>

          <section className="mb-2">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-500">
              Summary of features
            </h2>
            <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
              <table className="w-full min-w-[400px] text-left text-zinc-600 dark:text-zinc-400">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900/80">
                    <th className="px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300">Feature</th>
                    <th className="px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  <tr><td className="px-3 py-2 font-medium text-zinc-800 dark:text-zinc-200">Model Explorer</td><td className="px-3 py-2">Search, context slider, sortable table, expand row. Actions: Copy (run command), Download, link to Hugging Face.</td></tr>
                  <tr><td className="px-3 py-2 font-medium text-zinc-800 dark:text-zinc-200">Agent Fore</td><td className="px-3 py-2">Ollama/OpenClaw chat, auto-saved sessions, floating controls island, export chat.</td></tr>
                  <tr><td className="px-3 py-2 font-medium text-zinc-800 dark:text-zinc-200">Refresh</td><td className="px-3 py-2">Reload system and fit data.</td></tr>
                  <tr><td className="px-3 py-2 font-medium text-zinc-800 dark:text-zinc-200">Window controls</td><td className="px-3 py-2">Minimize, Maximize/Restore, Close (Electron).</td></tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-zinc-500 dark:text-zinc-500">
              All data (system, fit, recommendations) comes from the <code className="rounded bg-zinc-200 px-1 font-mono text-emerald-700 dark:bg-zinc-800 dark:text-emerald-400">forellm</code> binary; the GUI is a front-end that displays and triggers these operations.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
