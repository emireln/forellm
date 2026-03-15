# ForeLLM

<p align="center">
  <img src="assets/forellm.png" alt="ForeLLM icon" width="128" height="128">
</p>
<p align="center">
  <a href="https://github.com/emireln/forellm"><img src="https://img.shields.io/badge/github-emireln%2Fforellm-blue?logo=github" alt="GitHub"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License"></a>
</p>

**569+ models & providers. Find out the fits.**

A terminal tool that right-sizes LLM models to your system's RAM, CPU, and GPU. Detects your hardware, scores each model across quality, speed, fit, and context dimensions, and tells you which ones will actually run well on your machine.

Ships with an interactive **TUI** (default), a **classic CLI**, a **REST API** (`forellm serve`), and an optional **desktop GUI** (Electron + React) for a visual dashboard. Supports multi-GPU setups, MoE architectures, dynamic quantization selection, speed estimation, and local runtime providers (Ollama, llama.cpp, MLX).

**By Emir Lima, using the core of https://github.com/AlexsJones/llmfit.**

---

## Install

### Windows
```sh
scoop install forellm
```

If Scoop is not installed, follow the [Scoop installation guide](https://scoop.sh/).

### macOS / Linux

#### Homebrew
```sh
brew install forellm
```

#### Quick install (Linux/macOS)
```sh
curl -fsSL https://raw.githubusercontent.com/emireln/forellm/main/install.sh | sh
```
Installs the latest release to `/usr/local/bin` (or `~/.local/bin` with `sh -s -- --local`).

#### Docker
```sh
docker build -t forellm . && docker run --rm -it forellm
```
Builds the image and runs the TUI in one go. CLI examples: `docker run --rm forellm fit --json -n 5`, `docker run --rm forellm system --json`. If the image is published to GitHub Container Registry: `docker run --rm -it ghcr.io/emireln/forellm`.

#### From source
```sh
git clone https://github.com/emireln/forellm.git
cd forellm
cargo build --release
# binary is at target/release/forellm
```

---

## Usage

### TUI (default)

```sh
forellm
```

Launches the interactive terminal UI. Your system specs (CPU, RAM, GPU name, VRAM, backend) are shown at the top. Models are listed in a scrollable table sorted by composite score. Each row shows the model's score, estimated tok/s, best quantization for your hardware, run mode, memory usage, and use-case category.

| Key | Action |
|---|---|
| `Up` / `Down` or `j` / `k` | Navigate models |
| `/` | Enter search mode (partial match on name, provider, params, use case) |
| `Esc` or `Enter` | Exit search mode |
| `Ctrl-U` | Clear search |
| `f` | Cycle fit filter: All, Runnable, Perfect, Good, Marginal |
| `a` | Cycle availability filter: All, GGUF Avail, Installed |
| `s` | Cycle sort column: Score, Params, Mem%, Ctx, Date, Use Case |
| `t` | Cycle color theme (saved automatically) |
| `p` | Open Plan mode for selected model (hardware planning) |
| `P` | Open provider filter popup |
| `i` | Toggle installed-first sorting (any detected runtime provider) |
| `d` | Download selected model (provider picker when multiple are available) |
| `r` | Refresh installed models from runtime providers |
| `1`-`9` | Toggle provider visibility |
| `Enter` | Toggle detail view for selected model |
| `PgUp` / `PgDn` | Scroll by 10 |
| `g` / `G` | Jump to top / bottom |
| `q` | Quit |

### TUI Plan mode (`p`)

Plan mode inverts normal fit analysis: instead of asking "what fits my hardware?", it estimates "what hardware is needed for this model config?".

Use `p` on a selected row, then:

| Key | Action |
|---|---|
| `Tab` / `j` / `k` | Move between editable fields (Context, Quant, Target TPS) |
| `Left` / `Right` | Move cursor in current field |
| Type | Edit current field |
| `Backspace` / `Delete` | Remove characters |
| `Ctrl-U` | Clear current field |
| `Esc` or `q` | Exit Plan mode |

Plan mode shows estimates for:
- minimum and recommended VRAM/RAM/CPU cores
- feasible run paths (GPU, CPU offload, CPU-only)
- upgrade deltas to reach better fit targets

### Themes

Press `t` to cycle through 6 built-in color themes. Your selection is saved automatically to `~/.config/forellm/theme` and restored on next launch.

| Theme | Description |
|---|---|
| **Default** | Default ForeLLM colors |
| **Dracula** | Dark purple background with pastel accents |
| **Solarized** | Ethan Schoonover's Solarized Dark palette |
| **Nord** | Arctic, cool blue-gray tones |
| **Monokai** | Monokai Pro warm syntax colors |
| **Gruvbox** | Retro groove palette with warm earth tones |

### CLI mode

Use `--cli` or any subcommand to get classic table output:

```sh
# Table of all models ranked by fit
forellm --cli

# Only perfectly fitting models, top 5
forellm fit --perfect -n 5

# Include all models (e.g. for GUI; bypasses backend-compatibility filter)
forellm fit --json --all

# Show detected system specs
forellm system

# List all models in the database
forellm list

# Search by name, provider, or size
forellm search "llama 8b"

# Detailed view of a single model
forellm info "Mistral-7B"

# Top 5 recommendations (JSON, for agent/script consumption)
forellm recommend --json --limit 5

# Recommendations filtered by use case
forellm recommend --json --use-case coding --limit 3

# Plan required hardware for a specific model configuration
forellm plan "Qwen/Qwen3-4B-MLX-4bit" --context 8192
forellm plan "Qwen/Qwen3-4B-MLX-4bit" --context 8192 --quant mlx-4bit
forellm plan "Qwen/Qwen3-4B-MLX-4bit" --context 8192 --target-tps 25 --json

# Run as a node-level REST API (for cluster schedulers / aggregators)
forellm serve --host 0.0.0.0 --port 8787
```

### REST API (`forellm serve`)

`forellm serve` starts an HTTP API that exposes the same fit/scoring data used by TUI/CLI, including filtering and top-model selection for a node.

```sh
# Liveness
curl http://localhost:8787/health

# Node hardware info
curl http://localhost:8787/api/v1/system

# Full fit list with filters
curl "http://localhost:8787/api/v1/models?min_fit=marginal&runtime=llamacpp&sort=score&limit=20"

# Key scheduling endpoint: top runnable models for this node
curl "http://localhost:8787/api/v1/models/top?limit=5&min_fit=good&use_case=coding"

# Search by model name/provider text
curl "http://localhost:8787/api/v1/models/Mistral?runtime=any"
```

Supported query params for `models`/`models/top`:

- `limit` (or `n`): max number of rows returned
- `perfect`: `true|false` (forces perfect-only when `true`)
- `min_fit`: `perfect|good|marginal|too_tight`
- `runtime`: `any|mlx|llamacpp`
- `use_case`: `general|coding|reasoning|chat|multimodal|embedding`
- `provider`: provider text filter (substring)
- `search`: free-text filter across name/provider/size/use-case
- `sort`: `score|tps|params|mem|ctx|date|use_case`
- `include_too_tight`: include non-runnable rows (default `false` on `/top`, `true` on `/models`)
- `max_context`: per-request context cap for memory estimation

Validate API behavior locally:

```sh
# spawn server automatically and run endpoint/schema/filter assertions
python3 scripts/test_api.py --spawn

# or test an already-running server
python3 scripts/test_api.py --base-url http://127.0.0.1:8787
```

### GPU memory override

GPU VRAM autodetection can fail on some systems (e.g. broken `nvidia-smi`, VMs, passthrough setups). Use `--memory` to manually specify your GPU's VRAM:

```sh
# Override with 32 GB VRAM
forellm --memory=32G

# Megabytes also work (32000 MB ≈ 31.25 GB)
forellm --memory=32000M

# Works with all modes: TUI, CLI, and subcommands
forellm --memory=24G --cli
forellm --memory=24G fit --perfect -n 5
forellm --memory=24G system
forellm --memory=24G info "Llama-3.1-70B"
forellm --memory=24G recommend --json
```

Accepted suffixes: `G`/`GB`/`GiB` (gigabytes), `M`/`MB`/`MiB` (megabytes), `T`/`TB`/`TiB` (terabytes). Case-insensitive. If no GPU was detected, the override creates a synthetic GPU entry so models are scored for GPU inference.

### Context-length cap for estimation

Use `--max-context` to cap context length used for memory estimation (without changing each model's advertised maximum context):

```sh
# Estimate memory fit at 4K context
forellm --max-context 4096 --cli

# Works with subcommands
forellm --max-context 8192 fit --perfect -n 5
forellm --max-context 16384 recommend --json --limit 5
```

If `--max-context` is not set, ForeLLM will use `OLLAMA_CONTEXT_LENGTH` when available.

### Desktop GUI (Electron)

An optional visual dashboard runs the `forellm` binary under the hood and displays results in a dark, high-density interface. Requires Node.js and the `forellm` CLI built first.

```sh
# Build the CLI
cargo build --release

# Run the GUI (from repo root)
cd forellm-gui
npm install
npm run dev
```

**Installed app (Windows installer):** From `forellm-gui`, run `npm run dist`. This runs `pre-dist` (builds `forellm` with `cargo build --release` from the repo root) then packages the Electron app and **bundles the forellm binary** into the installer. The installed app uses this bundled binary, so no PATH or FORELLM_PATH is required. Installer output: `forellm-gui/release-build/`. To build the installer without bundling forellm (e.g. if you don’t have Rust): `npm run dist:no-binary` (users will need forellm on PATH or FORELLM_PATH).

**Launcher (first screen):** When you start the app, a **Launcher** lets you choose with one click (no commands to type). The launcher uses the same **theme** (dark / light / system) as the GUI—your preference is saved and applied on next launch.

- **Open ForeLLM GUI** — Dashboard in this window (Model Explorer, Agent Fore tab).
- **Run Agent in Terminal** — Opens a new terminal and runs the Agent Fore CLI (`npm run agent`).
- **Run ForeLLM CLI** — Opens a new terminal and runs the Rust `forellm` TUI.

Use the **Home** icon in the dashboard title bar to return to the launcher. See **[forellm-gui/docs/TUTORIAL_LAUNCHER.md](forellm-gui/docs/TUTORIAL_LAUNCHER.md)** for a step-by-step tutorial (launcher → GUI → Agent Fore in-app and CLI).

**Features:**

- **Model Explorer** — Full model list (569+; all fit levels including TooTight). Sortable table with Fit badges, quantization matrix, and context slider (2k–128k). Per-row actions: copy run command, download (runs `forellm download`), and **link to Hugging Face** (opens the model card in your browser). **Theme toggle** (dark / light / system) in the title bar next to Docs.
- **Agent Fore** — AI chat tab powered by Ollama (or OpenClaw). **Chat is auto-saved** (localStorage) so conversations persist when you close the app or switch tabs. **Floating controls island** at the top: click “Controls” to open Export/Agent/Backend/Model and chat actions; click outside to close. Real-time streaming, multiple agents (General, Data Analyst, Web Researcher, Coding Expert), and tools: read attached files (JSON, CSV, TXT, SVG), **analyze images** (PNG, JPEG, GIF, WebP via a vision model e.g. llava), run Python snippets (shown in IDE-style code blocks), web search, and run terminal commands with your confirmation (Allow/Deny). **Export chat** to Markdown or TXT (with or without tool calls). Attach files by drag-and-drop; the agent sees your system specs and the full ForeLLM model list. Commands like `forellm system --json` are resolved to the binary path when not on PATH. Reply buttons (Yes/No or custom) supported. Requires Ollama (or OpenClaw) running locally.

**Agent Fore CLI** — The same Agent Fore chat in the terminal. You can start it from the launcher (“Run Agent in Terminal”) or manually; see [Using Agent Fore from the CLI](#using-agent-fore-from-the-cli) below.

The GUI is in `forellm-gui/` (Electron + React + Tailwind). Set `FORELLM_PATH` to the binary if it is not in `../target/release/forellm`. The app and taskbar use `forellm-gui/public/forellm.png` as the window icon; the README uses `assets/forellm.png`. No in-app favicon.

**Full app documentation:** [forellm-gui/docs/APP.md](forellm-gui/docs/APP.md) — launcher, title bar, theme toggle, Model Explorer (search, context, copy/download, Hugging Face link), Agent Fore (Ollama chat, export chat), download behavior, and environment.

#### Using Agent Fore from the CLI

You can run Agent Fore in the terminal with the same agents and tools as the GUI (read files, web search, run Python, run shell commands with confirmation). The CLI auto-detects the currently running Ollama model (or the first available one), shows a styled banner, and supports slash commands. Type **`/help`** in the chat to list all commands.

**Prerequisites**

- Node.js 18+
- `forellm` binary (e.g. `cargo build --release` from repo root)
- [Ollama](https://ollama.com) installed and running; at least one model pulled (e.g. `ollama pull deepseek-v3`). If no model is running, the CLI uses the first model returned by Ollama.

**Run**

From the **forellm-gui** directory:

```sh
cd forellm-gui
npm install
npm run agent
```

Or: `npx tsx cli/agent-cli.ts`

**Startup options**

| Option | Description |
|--------|-------------|
| `--model <name>` | Force this Ollama model (otherwise auto-detect from running or available). |
| `--agent <id>` | Agent: `general`, `data`, `web`, or `coding` (default: `general`). |
| `--file <path>` | Attach a file; repeat to attach multiple. The agent can read them via `read_document` (text/SVG) or analyze images (PNG, JPEG, etc.) via `analyze_image`. |

**Examples**

```sh
# Auto-detect model, General Assistant
npm run agent

# Force a model and the Data Analyst agent
npm run agent -- --model qwen2.5:7b --agent data

# Attach files (JSON, CSV, TXT, etc.)
npm run agent -- --file ./data.csv --file ./notes.txt

# Web Researcher (has web_search)
npm run agent -- --agent web
```

**Slash commands (type `/help` in the chat)**

| Command | Description |
|---------|-------------|
| `/help` | Show all commands. |
| `/quit`, `/exit`, `/q` | Exit the CLI. |
| `/clear`, `/new` | Clear the conversation (keep agent, model, and attachments). |
| `/agent` [id] | Show current agent or switch: `general`, `data`, `web`, `coding`. |
| `/model` [name] | Show current model or switch Ollama model. |
| `/models` | List available Ollama models. |
| `/file` &lt;path&gt; | Attach a file (agent can `read_document`). |
| `/files` | List attached files. |

**During the chat**

- Type your message and press Enter. The agent may call tools (web search, read file, run Python, or run a shell command).
- If the agent asks to run a **shell command**, you'll see `Allow? [y/N]:` — type `y` and Enter to run, or Enter to deny.
- If the agent ends a message with reply buttons (e.g. `BUTTONS: Yes, No`), the CLI shows `[1] Yes  [2] No`; you can reply with the number or the label.

Set `FORELLM_PATH` to the `forellm` binary if it is not under `../target/release/forellm` relative to the repo.

### Landing page

The repo includes a single-page marketing landing in the **`website/`** folder: **`website/index.html`** (dark theme, hero, how-it-works, feature highlights, copyable install commands, GitHub and [Buy Me a Coffee](https://buymeacoffee.com/emireln) links). Open `website/index.html` in a browser or point your project site / GitHub Pages at the `website/` directory. The logo is `website/forellm.png`.

### JSON output

Add `--json` to any subcommand for machine-readable output:

```sh
forellm --json system     # Hardware specs as JSON
forellm --json fit -n 10  # Top 10 fits as JSON
forellm recommend --json  # Top 5 recommendations (JSON is default for recommend)
forellm plan "Qwen/Qwen2.5-Coder-0.5B-Instruct" --context 8192 --json
```

`plan` JSON includes stable fields for:
- request (`context`, `quantization`, `target_tps`)
- estimated minimum/recommended hardware
- per-path feasibility (`gpu`, `cpu_offload`, `cpu_only`)
- upgrade deltas

---

## How it works

1. **Hardware detection** -- Reads total/available RAM via `sysinfo`, counts CPU cores, and probes for GPUs:
   - **NVIDIA** -- Multi-GPU support via `nvidia-smi`. Aggregates VRAM across all detected GPUs. Falls back to VRAM estimation from GPU model name if reporting fails.
   - **AMD** -- Detected via `rocm-smi`.
   - **Intel Arc** -- Discrete VRAM via sysfs, integrated via `lspci`.
   - **Apple Silicon** -- Unified memory via `system_profiler`. VRAM = system RAM.
   - **Ascend** -- Detected via `npu-smi`.
   - **Backend detection** -- Automatically identifies the acceleration backend (CUDA, Metal, ROCm, SYCL, CPU ARM, CPU x86, Ascend) for speed estimation.

2. **Model database** -- 569+ models sourced from the HuggingFace API, stored in `data/hf_models.json` and embedded at compile time. Memory requirements are computed from parameter counts across a quantization hierarchy (Q8_0 through Q2_K). VRAM is the primary constraint for GPU inference; system RAM is the fallback for CPU-only execution.

   **MoE support** -- Models with Mixture-of-Experts architectures (Mixtral, DeepSeek-V2/V3) are detected automatically. Only a subset of experts is active per token, so the effective VRAM requirement is much lower than total parameter count suggests. For example, Mixtral 8x7B has 46.7B total parameters but only activates ~12.9B per token, reducing VRAM from 23.9 GB to ~6.6 GB with expert offloading.

3. **Dynamic quantization** -- Instead of assuming a fixed quantization, ForeLLM tries the best quality quantization that fits your hardware. It walks a hierarchy from Q8_0 (best quality) down to Q2_K (most compressed), picking the highest quality that fits in available memory. If nothing fits at full context, it tries again at half context.

4. **Multi-dimensional scoring** -- Each model is scored across four dimensions (0–100 each):

   | Dimension | What it measures |
   |---|---|
   | **Quality** | Parameter count, model family reputation, quantization penalty, task alignment |
   | **Speed** | Estimated tokens/sec based on backend, params, and quantization |
   | **Fit** | Memory utilization efficiency (sweet spot: 50–80% of available memory) |
   | **Context** | Context window capability vs target for the use case |

   Dimensions are combined into a weighted composite score. Weights vary by use-case category (General, Coding, Reasoning, Chat, Multimodal, Embedding). For example, Chat weights Speed higher (0.35) while Reasoning weights Quality higher (0.55). Models are ranked by composite score, with unrunnable models (Too Tight) always at the bottom.

5. **Speed estimation** -- Token generation in LLM inference is memory-bandwidth-bound: each token requires reading the full model weights once from VRAM. When the GPU model is recognized, ForeLLM uses its actual memory bandwidth to estimate throughput:

   Formula: `(bandwidth_GB_s / model_size_GB) × efficiency_factor`

   The efficiency factor (0.55) accounts for kernel overhead, KV-cache reads, and memory controller effects. This approach is validated against published benchmarks from llama.cpp ([Apple Silicon](https://github.com/ggml-org/llama.cpp/discussions/4167), [NVIDIA T4](https://github.com/ggml-org/llama.cpp/discussions/4225)) and real-world measurements.

   The bandwidth lookup table covers ~80 GPUs across NVIDIA (consumer + datacenter), AMD (RDNA + CDNA), and Apple Silicon families.

   For unrecognized GPUs, ForeLLM falls back to per-backend speed constants:

   | Backend | Speed constant |
   |---|---|
   | CUDA | 220 |
   | Metal | 160 |
   | ROCm | 180 |
   | SYCL | 100 |
   | CPU (ARM) | 90 |
   | CPU (x86) | 70 |
   | NPU (Ascend) | 390 |

   Fallback formula: `K / params_b × quant_speed_multiplier`, with penalties for CPU offload (0.5×), CPU-only (0.3×), and MoE expert switching (0.8×).

6. **Fit analysis** -- Each model is evaluated for memory compatibility:

   **Run modes:**
   - **GPU** -- Model fits in VRAM. Fast inference.
   - **MoE** -- Mixture-of-Experts with expert offloading. Active experts in VRAM, inactive in RAM.
   - **CPU+GPU** -- VRAM insufficient, spills to system RAM with partial GPU offload.
   - **CPU** -- No GPU. Model loaded entirely into system RAM.

   **Fit levels:**
   - **Perfect** -- Recommended memory met on GPU. Requires GPU acceleration.
   - **Good** -- Fits with headroom. Best achievable for MoE offload or CPU+GPU.
   - **Marginal** -- Tight fit, or CPU-only (CPU-only always caps here).
   - **Too Tight** -- Not enough VRAM or system RAM anywhere.

---

## Model database

The model list is generated by `scripts/scrape_hf_models.py`, a standalone Python script (stdlib only, no pip dependencies) that queries the HuggingFace REST API. 569+ models & providers including Meta Llama, Mistral, Qwen, Google Gemma, Microsoft Phi, DeepSeek, IBM Granite, Allen Institute OLMo, xAI Grok, Cohere, BigCode, 01.ai, Upstage, TII Falcon, HuggingFace, Zhipu GLM, Moonshot Kimi, Baidu ERNIE, and more. The scraper automatically detects MoE architectures via model config (`num_local_experts`, `num_experts_per_tok`) and known architecture mappings.

Model categories span general purpose, coding (CodeLlama, StarCoder2, WizardCoder, Qwen2.5-Coder, Qwen3-Coder), reasoning (DeepSeek-R1, Orca-2), multimodal/vision (Llama 3.2 Vision, Llama 4 Scout/Maverick, Qwen2.5-VL), chat, enterprise (IBM Granite), and embedding (nomic-embed, bge).

See [MODELS.md](MODELS.md) for the full list.

To refresh the model database:

```sh
# Automated update (recommended)
make update-models

# Or run the script directly
./scripts/update_models.sh

# Or manually
python3 scripts/scrape_hf_models.py
cargo build --release
```

**Add many more models quickly:** To add hundreds of trending models on top of the curated list, use `--discover` with a high limit. This fetches top text-generation models from HuggingFace by download count and appends them (skipping duplicates and repack orgs). Then rebuild:

```sh
python3 scripts/scrape_hf_models.py --discover -n 500
cargo build --release
```

Lower the bar for inclusion with `--min-downloads 5000` if you want more results. GGUF enrichment runs by default; use `--no-gguf-sources` for a faster scrape when you only need the extra models.

The scraper writes `data/hf_models.json`, which is baked into the binary via `include_str!`. The automated update script backs up existing data, validates JSON output, and rebuilds the binary.

By default, the scraper enriches models with known GGUF download sources from providers like [unsloth](https://huggingface.co/unsloth) and [bartowski](https://huggingface.co/bartowski). Results are cached in `data/gguf_sources_cache.json` (7-day TTL) to avoid repeated API calls. Use `--no-gguf-sources` to skip enrichment for a faster scrape.

---

## Project structure

```
forellm-core/       -- Core library: hardware detection, fit scoring, model DB, providers
  src/
    hardware.rs     -- System RAM/CPU/GPU detection (multi-GPU, backend identification)
    models.rs       -- Model database, quantization hierarchy, dynamic quant selection
    fit.rs          -- Multi-dimensional scoring (Q/S/F/C), speed estimation, MoE offloading
    providers.rs    -- Runtime provider integration (Ollama, llama.cpp, MLX), pull/download
    plan.rs         -- Hardware planning (what-if for a given model config)
forellm-tui/        -- CLI + TUI binary (forellm)
  src/
    main.rs         -- CLI argument parsing, entrypoint, TUI launch
    display.rs     -- Classic CLI table rendering + JSON output
    tui_app.rs     -- TUI application state, filters, navigation
    tui_ui.rs      -- TUI rendering (ratatui)
    tui_events.rs  -- TUI keyboard event handling (crossterm)
    serve_api.rs   -- REST API (forellm serve)
forellm-desktop/    -- Tauri desktop app (macOS; alternate to Electron GUI)
forellm-gui/        -- Electron + React desktop dashboard (optional)
  electron/        -- Main process: spawns forellm binary, IPC handlers
  src/             -- React app: model explorer, Agent Fore (export chat, theme)
data/
  hf_models.json   -- Model database (embedded at compile time)
skills/
  forellm-advisor/ -- OpenClaw skill for hardware-aware model recommendations
scripts/
  scrape_hf_models.py         -- HuggingFace API scraper
  update_models.sh            -- Automated database update script
  install-openclaw-skill.sh   -- Install the OpenClaw skill
  test_api.py                 -- REST API validation tests
Makefile            -- Build and maintenance commands
```

---

## Publishing to crates.io

The `Cargo.toml` already includes the required metadata (description, license). To publish:

```sh
# Dry run first to catch issues
cargo publish --dry-run

# Publish for real (requires a crates.io API token)
cargo login
cargo publish
```

Before publishing, make sure:

- The version in `Cargo.toml` is correct (bump with each release).
- A `LICENSE` file exists in the repo root. Create one if missing:

```sh
# For MIT license:
curl -sL https://opensource.org/license/MIT -o LICENSE
# Or write your own. The Cargo.toml declares license = "MIT".
```

- `data/hf_models.json` is committed. It is embedded at compile time and must be present in the published crate.
- The `exclude` list in `Cargo.toml` keeps `target/` and `scripts/` out of the published crate to keep the download small.

To publish updates:

```sh
# Bump version
# Edit Cargo.toml: version = "0.6.9"
cargo publish
```

---

## Dependencies

| Crate | Purpose |
|---|---|
| `clap` | CLI argument parsing with derive macros |
| `sysinfo` | Cross-platform RAM and CPU detection |
| `serde` / `serde_json` | JSON deserialization for model database |
| `tabled` | CLI table formatting |
| `colored` | CLI colored output |
| `ureq` | HTTP client for runtime/provider API integration |
| `ratatui` | Terminal UI framework |
| `crossterm` | Terminal input/output backend for ratatui |

---

## Runtime provider integration

ForeLLM supports multiple local runtime providers:

- **Ollama** (daemon/API based pulls)
- **llama.cpp** (direct GGUF downloads from Hugging Face + local cache detection)
- **MLX** (Apple Silicon / mlx-community model cache + optional server)

When more than one compatible provider is available for a model, pressing `d` in the TUI opens a provider picker modal.

### Ollama integration

ForeLLM integrates with [Ollama](https://ollama.com) to detect which models you already have installed and to download new ones directly from the TUI.

### Requirements

- **Ollama must be installed and running** (`ollama serve` or the Ollama desktop app)
- ForeLLM connects to `http://localhost:11434` (Ollama's default API port)
- No configuration needed — if Ollama is running, ForeLLM detects it automatically

### Remote Ollama instances

To connect to Ollama running on a different machine or port, set the `OLLAMA_HOST` environment variable:

```sh
# Connect to Ollama on a specific IP and port
OLLAMA_HOST="http://192.168.1.100:11434" forellm

# Connect via hostname  
OLLAMA_HOST="http://ollama-server:666" forellm

# Works with all TUI and CLI commands
OLLAMA_HOST="http://192.168.1.100:11434" forellm --cli
OLLAMA_HOST="http://192.168.1.100:11434" forellm fit --perfect -n 5
```

This is useful for:
- Running ForeLLM on one machine while Ollama serves from another (e.g., GPU server + laptop client)
- Connecting to Ollama running in Docker containers with custom ports
- Using Ollama behind reverse proxies or load balancers

### How it works

On startup, ForeLLM queries `GET /api/tags` to list your installed Ollama models. Each installed model gets a green **✓** in the **Inst** column of the TUI. The system bar shows `Ollama: ✓ (N installed)`.

When you press `d` on a model, ForeLLM sends `POST /api/pull` to Ollama to download it. The row highlights with an animated progress indicator showing download progress in real-time. Once complete, the model is immediately available for use with Ollama.

If Ollama is not running, Ollama-specific operations are skipped; the TUI still supports other providers like llama.cpp where available.

### llama.cpp integration

ForeLLM integrates with [llama.cpp](https://github.com/ggml-org/llama.cpp) as a runtime/download provider in both TUI and CLI.

Requirements:

- `llama-cli` or `llama-server` available in `PATH` (for runtime detection)
- network access to Hugging Face for GGUF downloads

How it works:

- ForeLLM maps HF models to known GGUF repos (with heuristic fallbacks)
- downloads GGUF files into the local llama.cpp model cache
- marks models installed when matching GGUF files are present locally

### Model name mapping

ForeLLM's database uses HuggingFace model names (e.g. `Qwen/Qwen2.5-Coder-14B-Instruct`) while Ollama uses its own naming scheme (e.g. `qwen2.5-coder:14b`). ForeLLM maintains an accurate mapping table between the two so that install detection and pulls resolve to the correct model. Each mapping is exact — `qwen2.5-coder:14b` maps to the Coder model, not the base `qwen2.5:14b`.

---

## Platform support

- **Linux** -- Full support. GPU detection via `nvidia-smi` (NVIDIA), `rocm-smi` (AMD), sysfs/`lspci` (Intel Arc) and `npu-smi` (Ascend).
- **macOS (Apple Silicon)** -- Full support. Detects unified memory via `system_profiler`. VRAM = system RAM (shared pool). Models run via Metal GPU acceleration.
- **macOS (Intel)** -- RAM and CPU detection works. Discrete GPU detection if `nvidia-smi` available.
- **Windows** -- RAM and CPU detection works. NVIDIA GPU detection via `nvidia-smi` if installed.

### GPU support

| Vendor | Detection method | VRAM reporting |
|---|---|---|
| NVIDIA | `nvidia-smi` | Exact dedicated VRAM |
| AMD | `rocm-smi` | Detected (VRAM may be unknown) |
| Intel Arc (discrete) | sysfs (`mem_info_vram_total`) | Exact dedicated VRAM |
| Intel Arc (integrated) | `lspci` | Shared system memory |
| Apple Silicon | `system_profiler` | Unified memory (= system RAM) |
| Ascend | `npu-smi` | Detected (VRAM may be unknown) |

If autodetection fails or reports incorrect values, use `--memory=<SIZE>` to override (see [GPU memory override](#gpu-memory-override) above).

---

## Contributing

Contributions are welcome, especially new models.

### Adding a model

1. Add the model's HuggingFace repo ID (e.g., `meta-llama/Llama-3.1-8B`) to the `TARGET_MODELS` list in `scripts/scrape_hf_models.py`.
2. If the model is gated (requires HuggingFace authentication to access metadata), add a fallback entry to the `FALLBACKS` list in the same script with the parameter count and context length.
3. Run the automated update script:
   ```sh
   make update-models
   # or: ./scripts/update_models.sh
   ```
4. Verify the updated model list: `./target/release/forellm list`
5. Optionally update [MODELS.md](MODELS.md) if you added notable models (the live database is `data/hf_models.json`).
6. Open a pull request.

See [MODELS.md](MODELS.md) for the current list and [AGENTS.md](AGENTS.md) for architecture details.

---

## OpenClaw integration

ForeLLM ships as an [OpenClaw](https://github.com/openclaw/openclaw) skill that lets the agent recommend hardware-appropriate local models and auto-configure Ollama/vLLM/LM Studio providers.

### Install the skill

```sh
# From the ForeLLM repo
./scripts/install-openclaw-skill.sh

# Or manually
cp -r skills/forellm-advisor ~/.openclaw/skills/
```

Once installed, ask your OpenClaw agent things like:

- "What local models can I run?"
- "Recommend a coding model for my hardware"
- "Set up Ollama with the best models for my GPU"

The agent will call `forellm recommend --json` under the hood, interpret the results, and offer to configure your `openclaw.json` with optimal model choices.

### How it works

The skill teaches the OpenClaw agent to:

1. Detect your hardware via `forellm --json system`
2. Get ranked recommendations via `forellm recommend --json`
3. Map HuggingFace model names to Ollama/vLLM/LM Studio tags
4. Configure `models.providers.ollama.models` in `openclaw.json`

See [skills/forellm-advisor/SKILL.md](skills/forellm-advisor/SKILL.md) for the full skill definition.

---

## License

MIT
