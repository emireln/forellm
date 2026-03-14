# ForeLLM Desktop GUI — Full documentation

This document describes the **Electron + React** desktop app in `forellm-gui/`: every panel, control, and feature.

---

## Overview

The GUI is a visual dashboard that runs the `forellm` CLI under the hood. It shows system telemetry, lets you simulate different hardware (VRAM, RAM, CPU cores), browse and score models, add them to a cart to check combined memory usage, and run download commands from inside the app.

**Tech:** Electron (main process), React + Tailwind (renderer), IPC to invoke `forellm` for `system`, `fit`, and `download`.

---

## Requirements and running

- **ForeLLM CLI** must be built first: `cargo build --release` (from repo root). The GUI looks for the binary at `../target/release/forellm` (or `../target/debug/forellm`).
- **Node.js** and npm (or equivalent) for the GUI.
- Optional: set `FORELLM_PATH` to the full path of the `forellm` binary if it is not in the default location.

```sh
# From repo root
cargo build --release
cd forellm-gui
npm install
npm run dev
```

Production build: `npm run build` then run the packaged app (e.g. Electron builder output).

---

## Title bar

- **ForeLLM** — App name and version badge (e.g. `v0.1.2026`).
- **SIMULATED** — Shown when the What-If Simulator is active (any hardware override applied).
- **Refresh** — Re-runs hardware detection and fit; reloads the model list with current (or simulated) specs.
- **Window controls** (when running in Electron): Minimize, Maximize/Restore, Close.

The title bar is draggable for moving the window (frameless window).

---

## Sidebar

The left sidebar has two main panels. It can be **collapsed** to a narrow strip with a single “expand” icon; **expand** again to see full content. Collapse/expand is instant (no animation).

### 1. System Telemetry

- **Header:** “System Telemetry” with icon.
- **Gauges (3):**
  - **RAM Used** — Cyan gauge: used system RAM vs total.
  - **VRAM** — Green gauge: GPU VRAM (or unified memory on Apple Silicon).
  - **Cores** — Orange gauge: CPU core count.
- **Spec list:** CPU name, RAM (total/free), GPU name, VRAM (with “unified” if applicable), Backend, OS. Each row has an icon, label, and value.

Values reflect **detected** hardware, or **simulated** hardware when the What-If Simulator is active.

### 2. What-If Simulator

- **Header:** “What-If Simulator” and an **ACTIVE** badge when any override is applied.
- **Description:** Explains that you can build a virtual hardware profile and see updated fit/scores.
- **Active hardware summary:** Current effective VRAM, RAM (GB), and Cores (from override or detected).
- **GPU VRAM:**
  - **Select GPU Preset** — Dropdown of presets (e.g. RTX 4090, A100 80GB, Apple M3 Max). Choosing one sets VRAM and applies the override.
  - **Custom VRAM** — Number input (GB); use with **Apply**.
- **System RAM (GB)** — Number input for total system RAM in the simulated profile.
- **CPU Cores** — Number input for core count in the simulated profile.
- **Apply** — Applies the current form values as a single hardware override (VRAM + RAM + Cores). Model list and scores refresh for the simulated system.
- **Reset** — Clears the override and reloads with detected hardware.

Only fields you change need to be filled; existing override values are kept for fields left blank when you click Apply. Reset clears everything.

---

## Model Explorer

Main content area: sortable table of models and the “paste & download” bar.

### Toolbar (top)

- **Model Explorer** label and model count (e.g. `569/569`).
- **Search** — Text filter on model name, provider, use case, parameter count.
- **Context** — Slider for context length (2k–128k). Affects memory estimation and scores; fit data is re-fetched with the selected context cap.
- **Loading** — Spinner when data is loading.

### Paste & run download

- **Input** — Paste a full command or just a model ID, e.g.:
  - `forellm download "Qwen/Qwen2-1.5B"`
  - `forellm download "org/model" --quant Q4_K_M`
  - `forellm download "org/model" --list`
  - Or only: `Qwen/Qwen2-1.5B` or `"Qwen/Qwen2-1.5B"`
- **Download** — Parses the input (model + optional `--quant`, `--list`) and runs `forellm download` under the hood. Button is disabled while a download is running or when the input cannot be parsed.
- **Result area** — After a run, success (green) or error (red) and stderr output are shown. **The message auto-disappears after 7 seconds.**

Only **GGUF** repositories are supported. If the repo has no GGUF files, the error suggests using `forellm hf-search <query>` to find GGUF models.

### Model table

- **Columns:** Expand, Model, Provider, Params, Quant, Mem Req, Score, Tok/s, Fit, Use Case, Actions.
- **Sort** — Click column headers (Params, Mem Req, Score, Tok/s) to sort; click again to toggle ascending/descending.
- **Expand row** — Click the chevron to show a second row with:
  - Quantization matrix (quality vs size).
  - Copy button for the run command (`ollama run <tag>` or `forellm download "<model>"`).
- **Add to cart** — Cart icon adds the model to the Multi-Model Cart (disabled if already in cart or fit is TooTight).
- **Copy command** — Copy icon copies the run/download command to the clipboard.

Fit badges (Perfect, Good, Marginal, TooTight) and colors indicate how well the model fits current (or simulated) hardware.

---

## Multi-Model Cart

Bottom bar spanning the full width.

- **Empty state:** Only a cart icon is shown (no explanatory text).
- **With items:**
  - **Header:** “Multi-Model Cart”, item count, **Clear** button.
  - **List:** Each item shows fit badge, short name, memory (GB), and remove (X).
  - **Total VRAM required** — Bar and label: sum of model memory vs available VRAM.
  - **Status:** “Combined stack fits in VRAM”, “Exceeds VRAM — CPU offload required”, or “Exceeds available memory” depending on total vs VRAM/RAM.

Use the cart to check whether several models (e.g. LLM + embedding) fit together in VRAM or RAM.

---

## Agent Fore (Ollama chat)

The **Agent Fore** tab is an AI chat powered by Ollama, with multiple agents (General, Data Analyst, Web Researcher, Coding Expert) and tools: read attached files, web search, run Python, and run terminal commands (with Allow/Deny). The agent has access to your system specs and the ForeLLM model list.

**Same chat from the terminal (Agent Fore CLI):** From the `forellm-gui` directory run `npm run agent` (or `npx tsx cli/agent-cli.ts`). Model is auto-detected from Ollama; use `--model`, `--agent general|data|web|coding`, and `--file <path>` to override or attach files. In the chat, type **`/help`** to see slash commands (`/clear`, `/agent`, `/model`, `/models`, `/file`, `/files`, etc.). See [AGENT_FORE_ARCHITECTURE.md](AGENT_FORE_ARCHITECTURE.md) for full usage.

---

## Download command (CLI behavior)

The GUI runs `forellm download <model> [--quant X] [--list]` via IPC.

- **Model** can be:
  - A HuggingFace repo ID: `"org/model-name"`.
  - A search query: ForeLLM searches HuggingFace for GGUF repos and picks one.
  - A known short name mapped to a GGUF repo.
- **--quant** — Choose a specific quantization (e.g. `Q4_K_M`, `Q8_0`). Omitted = auto-select by hardware.
- **--list** — List GGUF files in the repo only; no download.

Only repos that contain **GGUF** files work. Repos with only PyTorch/safetensors will show “No GGUF files found”. Use `forellm hf-search <query>` in a terminal to find GGUF models, or pick repos that mention GGUF in the name/description (e.g. many from TheBloke, bartowski).

---

## Environment

- **FORELLM_PATH** — Full path to the `forellm` binary. If unset, the app uses `../target/release/forellm` or `../target/debug/forellm` relative to the GUI root.

---

## Summary of features

| Feature | Description |
|--------|--------------|
| **System Telemetry** | Gauges (RAM, VRAM, Cores) and spec list (CPU, RAM, GPU, VRAM, Backend, OS). |
| **What-If Simulator** | Override VRAM (presets or custom), RAM (GB), CPU cores; Apply / Reset; model list and scores update. |
| **Sidebar collapse** | Collapse to icon strip; expand to full sidebar. Instant. |
| **Model Explorer** | Search, context slider, sortable table, expand row, add to cart, copy run/download command. |
| **Paste & download** | Paste command or model ID; parse and run `forellm download`; result auto-dismisses after 7 s. |
| **Multi-Model Cart** | Add models from table; see total VRAM and fit status; Clear. Empty state: cart icon only. |
| **Refresh** | Reload system and fit data (respects current simulator override). |
| **Window controls** | Minimize, Maximize/Restore, Close (Electron). |
| **Agent Fore** | Ollama chat tab: agents (General, Data Analyst, Web Researcher, Coding Expert), tools (read file, web search, Python, run command with confirm). Also available as CLI: `npm run agent` from `forellm-gui`. |

All data (system, fit, recommendations) comes from the `forellm` binary; the GUI is a front-end that displays and triggers these operations.
