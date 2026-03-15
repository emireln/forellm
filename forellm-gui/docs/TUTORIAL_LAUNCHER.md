# Tutorial: Launcher, GUI, and Agent Fore

This tutorial walks you through the **ForeLLM desktop app**: the launcher screen, the Model Explorer GUI, and how they connect to **Agent Fore** (in the app or in the terminal).

---

## 1. Starting the app

After building and running the GUI:

```sh
cd forellm-gui
npm install
npm run dev
```

(or run the packaged app from your installer), the first screen you see is the **Launcher**.

---

## 2. The Launcher

The launcher lets you choose how to use ForeLLM **without typing commands**. It uses the same **theme** (dark / light / system) as the GUI, so if you’ve set light mode in the dashboard, the launcher will show in light mode when you open the app or return via Home.

| Option | What it does |
|--------|----------------|
| **Open ForeLLM GUI** | Opens the main dashboard in this window: Model Explorer and Agent Fore chat tab. Theme toggle (dark/light/system) and Docs in the title bar. |
| **Run Agent in Terminal** | Opens a **new terminal window** and runs the Agent Fore CLI (`npm run agent`) there. Same agents and tools as the in-app Agent Fore tab. |
| **Run ForeLLM CLI** | Opens a **new terminal window** and runs the Rust **forellm** TUI (interactive terminal UI). Browse and filter models in the terminal. |

- **Open ForeLLM GUI** — Use this when you want the visual dashboard (model table, chat, export, Hugging Face links in one window).
- **Run Agent in Terminal** — Use this when you prefer a terminal-based chat (e.g. with `--file`, `--agent`, `--model`). The launcher starts it for you so you don’t have to `cd forellm-gui` and run `npm run agent` yourself.
- **Run ForeLLM CLI** — Use this when you want the classic ForeLLM TUI in a separate terminal (keyboard-driven model list, fit filters, download).

**Back to launcher:** Once you’re in the GUI dashboard, use the **Home** (house) icon in the title bar to return to the launcher and pick another option.

**Note:** For “Run ForeLLM CLI” to work, the `forellm` binary must be built (`cargo build --release` from repo root). If it’s not in the default path, set `FORELLM_PATH` to the binary location.

---

## 3. From Launcher to Agent Fore (in the GUI)

1. On the launcher, click **Open ForeLLM GUI**.
2. The dashboard opens: tabs for **Model Explorer** (table of models; copy, download, link to Hugging Face) and **Agent Fore** (chat). Use the theme toggle in the title bar for dark/light/system.
3. Click the **Agent Fore** tab to open the chat.
4. Choose an agent (General, Data Analyst, Web Researcher, Coding Expert), type a message, and use tools: attach files (drag-and-drop), analyze images, web search, run Python, or run terminal commands (with Allow/Deny). Export the conversation via **Export** (Markdown or TXT, with or without tool calls).

The agent has access to your **system specs** and the **ForeLLM model list**. When it suggests or runs `forellm` commands, the app uses the same binary as the rest of the GUI (or `FORELLM_PATH`).

---

## 4. From Launcher to Agent Fore (in the terminal)

1. On the launcher, click **Run Agent in Terminal**.
2. A new terminal window opens and starts the Agent Fore CLI (`npm run agent`) in the `forellm-gui` directory.
3. You get the same chat experience as the Agent Fore tab, but in the terminal: type messages, use slash commands (e.g. `/help`, `/agent`, `/model`, `/file`), and approve or deny shell commands when prompted.

This is the same binary path and behavior as running `npm run agent` yourself from `forellm-gui`; the launcher just does it in one click.

---

## 5. From Launcher to ForeLLM TUI (Rust CLI)

1. On the launcher, click **Run ForeLLM CLI**.
2. A new terminal window opens and runs the **forellm** binary (the Rust TUI).
3. Use the keyboard to navigate models, search, filter by fit, download, and open Plan mode. See the main ForeLLM README for TUI keybindings.

The launcher uses the same binary resolution as the GUI (e.g. `../target/release/forellm` or `FORELLM_PATH`).

---

## 6. Context flow summary

- **Launcher** → single entry point: choose GUI, Agent in terminal, or ForeLLM TUI.
- **Open ForeLLM GUI** → Dashboard (Model Explorer + Agent Fore tab; theme toggle, Docs, copy/download, Hugging Face link, export chat). Home button → back to launcher.
- **Run Agent in Terminal** → Agent Fore CLI in a new window; no need to open a terminal and run `npm run agent` manually.
- **Run ForeLLM CLI** → ForeLLM TUI in a new window; same as running `forellm` in a terminal.

For full Agent Fore usage (slash commands, tools, CLI options), see [AGENT_FORE_ARCHITECTURE.md](AGENT_FORE_ARCHITECTURE.md). For the full GUI (title bar, theme, Model Explorer, download, Hugging Face, export chat), see [APP.md](APP.md).
