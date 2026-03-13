import { X } from 'lucide-react'

interface Props {
  onClose: () => void
}

export function Documentation({ onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 pt-12 pb-12"
      role="dialog"
      aria-modal="true"
      aria-label="App documentation"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl overflow-hidden rounded-xl border border-zinc-700/80 bg-zinc-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-xl border-b border-zinc-800 bg-zinc-900/95 px-4 py-3 backdrop-blur-sm">
          <h1 className="text-base font-semibold text-zinc-100">
            ForeLLM Desktop GUI — Documentation
          </h1>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-zinc-400 transition hover:bg-zinc-700 hover:text-zinc-200"
            aria-label="Close documentation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[calc(90vh-4rem)] overflow-y-auto px-5 py-6 text-sm text-zinc-300 scrollbar-thin">
          <section className="mb-6">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Overview
            </h2>
            <p className="leading-relaxed">
              The GUI is a visual dashboard that runs the <strong className="text-zinc-200">forellm</strong> CLI under the hood. It shows system telemetry, lets you simulate different hardware (VRAM, RAM, CPU cores), browse and score models, and run download commands from inside the app.
            </p>
            <p className="mt-2 leading-relaxed">
              <strong className="text-zinc-200">Tech:</strong> Electron (main process), React + Tailwind (renderer), IPC to invoke <code className="rounded bg-zinc-800 px-1 font-mono text-emerald-400">forellm</code> for <code className="rounded bg-zinc-800 px-1 font-mono text-emerald-400">system</code>, <code className="rounded bg-zinc-800 px-1 font-mono text-emerald-400">fit</code>, and <code className="rounded bg-zinc-800 px-1 font-mono text-emerald-400">download</code>.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Requirements & running
            </h2>
            <ul className="list-inside list-disc space-y-1 text-zinc-400">
              <li><strong className="text-zinc-300">ForeLLM CLI</strong> must be built first: <code className="rounded bg-zinc-800 px-1 font-mono text-emerald-400">cargo build --release</code> (from repo root).</li>
              <li><strong className="text-zinc-300">Node.js</strong> and npm for the GUI.</li>
              <li>Optional: set <code className="rounded bg-zinc-800 px-1 font-mono text-emerald-400">FORELLM_PATH</code> to the full path of the <code className="rounded bg-zinc-800 px-1 font-mono text-emerald-400">forellm</code> binary.</li>
            </ul>
            <pre className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900/80 p-3 font-mono text-xs text-zinc-400">
{`# From repo root
cargo build --release
cd forellm-gui
npm install
npm run dev`}
            </pre>
          </section>

          <section className="mb-6">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Title bar
            </h2>
            <ul className="space-y-1.5 text-zinc-400">
              <li><strong className="text-zinc-300">ForeLLM</strong> — App name and version badge.</li>
              <li><strong className="text-zinc-300">SIMULATED</strong> — Shown when the What-If Simulator is active.</li>
              <li><strong className="text-zinc-300">Refresh</strong> — Re-runs hardware detection and fit; reloads the model list.</li>
              <li><strong className="text-zinc-300">Docs</strong> — Opens this documentation.</li>
              <li><strong className="text-zinc-300">Window controls</strong> — Minimize, Maximize/Restore, Close (Electron).</li>
            </ul>
            <p className="mt-2 text-zinc-500">The title bar is draggable for moving the window.</p>
          </section>

          <section className="mb-6">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Sidebar
            </h2>
            <p className="mb-3 leading-relaxed text-zinc-400">
              The left sidebar has two panels. It can be <strong className="text-zinc-300">collapsed</strong> to a narrow strip with an expand icon; <strong className="text-zinc-300">expand</strong> again to see full content. Collapse/expand is instant.
            </p>

            <h3 className="mb-1.5 font-medium text-zinc-200">1. System Telemetry</h3>
            <ul className="mb-3 list-inside list-disc space-y-1 text-zinc-400">
              <li><strong className="text-zinc-300">Gauges:</strong> RAM Used (cyan), VRAM (green), Cores (orange).</li>
              <li><strong className="text-zinc-300">Spec list:</strong> CPU, RAM, GPU, VRAM, Backend, OS — each with an icon.</li>
            </ul>
            <p className="mb-3 text-zinc-500">Values reflect detected or simulated hardware when the simulator is active.</p>

            <h3 className="mb-1.5 font-medium text-zinc-200">2. What-If Simulator</h3>
            <ul className="list-inside list-disc space-y-1 text-zinc-400">
              <li><strong className="text-zinc-300">GPU VRAM</strong> — Preset dropdown (e.g. RTX 4090, A100 80GB) or custom GB input.</li>
              <li><strong className="text-zinc-300">System RAM (GB)</strong> — Number input for simulated total RAM.</li>
              <li><strong className="text-zinc-300">CPU Cores</strong> — Number input for simulated core count.</li>
              <li><strong className="text-zinc-300">Apply</strong> — Applies overrides; model list and scores refresh.</li>
              <li><strong className="text-zinc-300">Reset</strong> — Clears override and reloads with detected hardware.</li>
            </ul>
          </section>

          <section className="mb-6">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Model Explorer
            </h2>
            <p className="mb-3 leading-relaxed text-zinc-400">
              Main content: sortable table of models and the paste-and-download bar.
            </p>

            <h3 className="mb-1.5 font-medium text-zinc-200">Toolbar</h3>
            <ul className="mb-3 list-inside list-disc space-y-1 text-zinc-400">
              <li><strong className="text-zinc-300">Model Explorer</strong> label and model count.</li>
              <li><strong className="text-zinc-300">Search</strong> — Filter by name, provider, use case, params.</li>
              <li><strong className="text-zinc-300">Context</strong> — Slider (2k–128k); affects memory and fit; data re-fetched with selected cap.</li>
            </ul>

            <h3 className="mb-1.5 font-medium text-zinc-200">Paste & run download</h3>
            <ul className="mb-3 list-inside list-disc space-y-1 text-zinc-400">
              <li><strong className="text-zinc-300">Input</strong> — Paste a full command or model ID, e.g. <code className="rounded bg-zinc-800 px-1 font-mono text-emerald-400">forellm download "Qwen/Qwen2-1.5B"</code> or <code className="rounded bg-zinc-800 px-1 font-mono text-emerald-400">Qwen/Qwen2-1.5B</code>.</li>
              <li><strong className="text-zinc-300">Download</strong> — Runs <code className="rounded bg-zinc-800 px-1 font-mono text-emerald-400">forellm download</code>; supports <code className="rounded bg-zinc-800 px-1 font-mono text-emerald-400">--quant</code>, <code className="rounded bg-zinc-800 px-1 font-mono text-emerald-400">--list</code>.</li>
              <li>Result (success or error) <strong className="text-zinc-300">auto-dismisses after 7 seconds</strong>. Only GGUF repos are supported.</li>
            </ul>

            <h3 className="mb-1.5 font-medium text-zinc-200">Model table</h3>
            <ul className="list-inside list-disc space-y-1 text-zinc-400">
              <li><strong className="text-zinc-300">Columns:</strong> Expand, Model, Provider, Params, Quant, Mem Req, Score, Tok/s, Fit, Use Case, Actions.</li>
              <li><strong className="text-zinc-300">Sort</strong> — Click headers (Params, Mem Req, Score, Tok/s); click again to toggle order.</li>
              <li><strong className="text-zinc-300">Expand row</strong> — Chevron shows quantization matrix and copy-run-command button.</li>
              <li><strong className="text-zinc-300">Add to cart</strong> — Cart icon adds the model to the Multi-Model Cart to check combined memory vs effective hardware (VRAM, RAM, cores). Uses the same effective hardware as the What-If Simulator when active.</li>
              <li><strong className="text-zinc-300">Copy command</strong> — Copies <code className="rounded bg-zinc-800 px-1 font-mono text-emerald-400">ollama run &lt;tag&gt;</code> or <code className="rounded bg-zinc-800 px-1 font-mono text-emerald-400">forellm download "&lt;model&gt;"</code>.</li>
            </ul>
            <p className="mt-2 text-zinc-500">Fit badges (Perfect, Good, Marginal, TooTight) show how well the model fits current or simulated hardware.</p>

            <h3 className="mb-1.5 mt-3 font-medium text-zinc-200">Multi-Model Cart</h3>
            <p className="mb-2 text-zinc-400">Bottom bar: add models from the table to see total memory required vs <strong className="text-zinc-300">effective hardware</strong> (VRAM, RAM, CPU cores). When the What-If Simulator is active, the cart uses the same simulated values. Status: fits in VRAM, fits in RAM (CPU offload), or exceeds memory.</p>
          </section>

          <section className="mb-6">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Download command (CLI)
            </h2>
            <p className="mb-2 leading-relaxed text-zinc-400">
              The GUI runs <code className="rounded bg-zinc-800 px-1 font-mono text-emerald-400">forellm download &lt;model&gt; [--quant X] [--list]</code> via IPC. Model can be a HuggingFace repo ID, a search query, or a known short name. Only repos with <strong className="text-zinc-300">GGUF</strong> files work; use <code className="rounded bg-zinc-800 px-1 font-mono text-emerald-400">forellm hf-search &lt;query&gt;</code> in a terminal to find GGUF models.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Environment
            </h2>
            <p className="leading-relaxed text-zinc-400">
              <code className="rounded bg-zinc-800 px-1 font-mono text-emerald-400">FORELLM_PATH</code> — Full path to the <code className="rounded bg-zinc-800 px-1 font-mono text-emerald-400">forellm</code> binary. If unset, the app uses <code className="rounded bg-zinc-800 px-1 font-mono text-emerald-400">../target/release/forellm</code> or <code className="rounded bg-zinc-800 px-1 font-mono text-emerald-400">../target/debug/forellm</code>.
            </p>
          </section>

          <section className="mb-2">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Summary of features
            </h2>
            <div className="overflow-x-auto rounded-lg border border-zinc-800">
              <table className="w-full min-w-[400px] text-left text-zinc-400">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/80">
                    <th className="px-3 py-2 text-xs font-medium text-zinc-300">Feature</th>
                    <th className="px-3 py-2 text-xs font-medium text-zinc-300">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  <tr><td className="px-3 py-2 font-medium text-zinc-200">System Telemetry</td><td className="px-3 py-2">Gauges (RAM, VRAM, Cores) and spec list (CPU, RAM, GPU, VRAM, Backend, OS).</td></tr>
                  <tr><td className="px-3 py-2 font-medium text-zinc-200">What-If Simulator</td><td className="px-3 py-2">Override VRAM, RAM, CPU cores; Apply / Reset; model list and scores update.</td></tr>
                  <tr><td className="px-3 py-2 font-medium text-zinc-200">Sidebar collapse</td><td className="px-3 py-2">Collapse to icon strip; expand to full sidebar. Instant.</td></tr>
                  <tr><td className="px-3 py-2 font-medium text-zinc-200">Model Explorer</td><td className="px-3 py-2">Search, context slider, sortable table, expand row, copy run/download command.</td></tr>
                  <tr><td className="px-3 py-2 font-medium text-zinc-200">Paste & download</td><td className="px-3 py-2">Paste command or model ID; run forellm download; result auto-dismisses after 7 s.</td></tr>
                  <tr><td className="px-3 py-2 font-medium text-zinc-200">Multi-Model Cart</td><td className="px-3 py-2">Add models; see total memory vs effective VRAM/RAM/cores (same as simulator when active).</td></tr>
                  <tr><td className="px-3 py-2 font-medium text-zinc-200">Refresh</td><td className="px-3 py-2">Reload system and fit data (respects simulator override).</td></tr>
                  <tr><td className="px-3 py-2 font-medium text-zinc-200">Window controls</td><td className="px-3 py-2">Minimize, Maximize/Restore, Close (Electron).</td></tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-zinc-500">
              All data (system, fit, recommendations) comes from the <code className="rounded bg-zinc-800 px-1 font-mono text-emerald-400">forellm</code> binary; the GUI is a front-end that displays and triggers these operations.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
