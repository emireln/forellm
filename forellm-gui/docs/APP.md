# ForeLLM Desktop GUI — Full documentation

This document describes the **Electron + React** desktop app in `forellm-gui/`: every panel, control, and feature.

---

## Overview

The GUI is a visual dashboard that runs the `forellm` CLI under the hood. It lets you browse and score models, run download commands, open Hugging Face model cards, and chat with Agent Fore (with optional export of conversations). The app supports **dark**, **light**, and **system** themes (toggle in the title bar).

**Tech:** Electron (main process), React + Tailwind (renderer), IPC to invoke `forellm` for `system`, `fit`, and `download`.

---

## Launcher (first screen)

When you start the app, the **Launcher** is the first screen. It uses the same **theme** (dark / light / system) as the rest of the app—your choice is stored in the browser and applied when you open the launcher or return to it via the Home button. It offers three actions (no commands to type):

| Action | Description |
|--------|-------------|
| **Open ForeLLM GUI** | Opens the main dashboard in the current window: Model Explorer and Agent Fore chat tab. |
| **Run Agent in Terminal** | Opens a **new terminal** and runs the Agent Fore CLI (`npm run agent`) there. Same agents and tools as the in-app Agent Fore tab. |
| **Run ForeLLM CLI** | Opens a **new terminal** and runs the Rust **forellm** TUI (interactive model list, fit filters, download). |

- Use **Open ForeLLM GUI** when you want the visual dashboard (model table, chat, theme toggle in one window).
- Use **Run Agent in Terminal** when you prefer the Agent Fore chat in a separate terminal (e.g. with `--file`, `--agent`); the launcher starts it for you.
- Use **Run ForeLLM CLI** when you want the classic ForeLLM TUI in a terminal.

From the dashboard, the **Home** (house) icon in the title bar returns you to the Launcher.

**Tutorial:** See [TUTORIAL_LAUNCHER.md](TUTORIAL_LAUNCHER.md) for a step-by-step guide from the launcher to the GUI and Agent Fore (in-app and CLI).

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

- **Home** — Returns to the Launcher (first screen) so you can switch to Agent in terminal or ForeLLM CLI.
- **ForeLLM** — App name and version badge (e.g. `v0.1.2026`).
- **Refresh** — Re-runs hardware detection and fit; reloads the model list.
- **Docs** — Opens in-app documentation.
- **Theme** — Cycle **dark** / **light** / **system**. Preference is saved; system follows OS preference.
- **Window controls** (when running in Electron): Minimize, Maximize/Restore, Close.

The title bar is draggable for moving the window (frameless window).

---

## Model Explorer

Main content area: sortable table of models and the paste & download bar.

### Toolbar (top)

- **Model Explorer** label and model count (e.g. `569/569`; full list including TooTight).
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
  - **View on Hugging Face** — Link to the model's card on Hugging Face.
- **Copy command** — Copy icon copies the run/download command to the clipboard.
- **Hugging Face** — Link icon (in the model name cell) opens the model card at `https://huggingface.co/<model>` in your browser. In the expanded row: **View on Hugging Face** link.

Fit badges (Perfect, Good, Marginal, TooTight) and colors indicate how well the model fits your detected hardware.

---

## Agent Fore (Ollama / OpenClaw chat)

The **Agent Fore** tab is an AI chat powered by Ollama or OpenClaw, with multiple agents (General, Data Analyst, Web Researcher, Coding Expert) and tools: read attached files (text, JSON, CSV, SVG), **analyze images** (PNG, JPEG, GIF, WebP — uses a vision model such as llava; set `OLLAMA_VISION_MODEL` to override), web search, run Python (code shown in IDE-style blocks), and run terminal commands (with Allow/Deny). The agent has access to your system specs and the ForeLLM model list. When the agent runs `forellm` commands, the app resolves the binary path if it is not on PATH.

- **Auto-save** — Conversations and settings (sessions, selected agent, backend, model) are saved to the browser (localStorage) and restored when you reopen the app or return to the Agent Fore tab.
- **Floating controls island** — At the top of the chat area, a floating **Controls** pill opens the toolbar (Export, Agent, Backend, Model, New chat, Reset, Remove, Rename, History). Click outside the island to close it so the chat area stays uncluttered.
- **Export chat** — In the controls island, use **Export** to download the current conversation as **Markdown** or **TXT**. Choose “clean” (tool calls stripped) or “with tool calls” for full logs and support.

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
| **Launcher** | First screen: Open ForeLLM GUI, Run Agent in Terminal, or Run ForeLLM CLI (one click, no commands). Follows the same theme (dark/light/system) as the GUI. Home button in dashboard returns to launcher. |
| **Theme** | Dark / light / system toggle in title bar; preference saved. |
| **Model Explorer** | Search, context slider, sortable table, expand row, copy run/download command, link to Hugging Face model card. |
| **Paste & download** | Paste command or model ID; parse and run `forellm download`; result auto-dismisses after 7 s. |
| **Refresh** | Reload system and fit data. |
| **Window controls** | Minimize, Maximize/Restore, Close (Electron). |
| **Agent Fore** | Ollama/OpenClaw chat tab: **auto-saved** conversations, **floating controls island** (Export, Agent, Backend, Model, chat actions; click outside to close). Agents (General, Data Analyst, Web Researcher, Coding Expert), tools (read file, analyze image, web search, Python with IDE-style code blocks, run command with confirm), **export chat** (Markdown/TXT, with or without tool calls). Image analysis uses a vision model (e.g. llava). CLI: `npm run agent` from `forellm-gui` or via launcher “Run Agent in Terminal”. |

All data (system, fit, recommendations) comes from the `forellm` binary; the GUI is a front-end that displays and triggers these operations. See [TUTORIAL_LAUNCHER.md](TUTORIAL_LAUNCHER.md) for a launcher-to-Agent walkthrough.
