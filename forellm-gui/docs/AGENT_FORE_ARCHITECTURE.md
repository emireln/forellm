# Agent Fore — Architecture & Feature Set

Agent Fore is a flexible, chat-based AI assistant available in the **ForeLLM desktop GUI** and as a **CLI**. It supports **multimodal inputs**, **file attachments**, **multi-agent selection**, and **backend tool execution**, with an architecture that can grow to include RAG and streaming.

---

## 0. CLI vs GUI

| Interface | How to run | Same behavior |
|-----------|------------|----------------|
| **GUI** | ForeLLM desktop app → Agent Fore tab | Streaming, file drag-and-drop, Allow/Deny for run_command, reply buttons |
| **CLI** | From `forellm-gui`: `npm run agent` or `npx tsx cli/agent-cli.ts` | Same agents (general, data, web, coding), same tools (read_document, web_search, execute_python, run_command with terminal y/N confirm). Attach files with `--file path`. Requires Node 18+, `forellm` binary, Ollama. |

The CLI shares `forellm-gui/src/lib/agentConfig.ts` (system prompts and tool schemas) and implements the same Ollama tool-calling loop and tool runners (read file by path, web search, Python subprocess, run_command with confirmation). It auto-detects the Ollama model (currently running via `/api/ps`, or first available via `/api/tags`), shows a styled banner, and supports slash commands; type **`/help`** to list them.

### How to use Agent Fore from the CLI

1. **Prerequisites**
   - Node.js 18+
   - `forellm` binary built (e.g. `cargo build --release` from repo root)
   - Ollama installed and running; at least one model pulled. The CLI auto-detects the running or first available model unless `--model` is passed.

2. **Start the CLI**
   - From repo root: `cd forellm-gui && npm install && npm run agent`
   - Or: `npx tsx cli/agent-cli.ts` (from inside `forellm-gui`)

3. **Startup options**
   - `--model <name>` — Force this Ollama model (otherwise auto-detect).
   - `--agent general|data|web|coding` — Agent persona and tool set (default: `general`).
   - `--file <path>` — Attach a file; repeat for multiple. The agent can read them via `read_document`.

4. **Slash commands (in-chat)**  
   Type `/help` to see the full list. Summary:
   - `/help` — Show all commands.
   - `/quit`, `/exit`, `/q` — Exit.
   - `/clear`, `/new` — Clear conversation (keep agent, model, attachments).
   - `/agent` [id] — Show or switch agent (general, data, web, coding).
   - `/model` [name] — Show or switch Ollama model.
   - `/models` — List available Ollama models.
   - `/file` <path> — Attach a file.
   - `/files` — List attached files.

5. **During the chat**
   - Type your message and press Enter.
   - If the agent requests a shell command, you'll see `Run: <command>` and `Allow? [y/N]:`. Type `y` + Enter to run, or Enter to deny.
   - If the agent ends with reply buttons (e.g. `BUTTONS: Yes, No`), the CLI shows `[1] Yes  [2] No`; reply with the number or label.
   - Type `/quit`, `/exit`, or `/q` to exit.

If the `forellm` binary is not in `../target/release/forellm`, set the `FORELLM_PATH` environment variable to its path.

---

## 1. Recommended Tech Stack

| Layer | Technology | Notes |
|-------|------------|--------|
| **Frontend** | React 19 + Tailwind CSS | Existing ForeLLM GUI stack; rich Markdown/code via react-markdown + react-syntax-highlighter |
| **Desktop runtime** | Electron | Main process runs tools (web search, read file, execute Python); preload exposes IPC |
| **LLM** | Ollama (local) | Primary backend; supports tool-calling and streaming; optional future: OpenAI-compatible API |
| **Conversation state** | In-memory (React state) + localStorage | GUI: sessions, current chat, agent/backend/model settings auto-saved (localStorage); restored on reopen or tab switch. CLI: session-only. Optional future: SQLite or JSON in app data dir. |
| **File store** | Temp directory + in-memory map | Uploaded files written to `os.tmpdir()/forellm-agent-uploads`; metadata in Map<file_id, { path, name, mime }> |
| **RAG (optional)** | Vector DB + embeddings | For full RAG: embed chunks (e.g. Ollama embeddings or external API), store in SQLite+vec or Chroma; retrieve and inject into context |
| **Tool execution** | Node.js (Electron main) | web_search via fetch; read_document via fs; execute_python via child_process with timeout and env restrictions |

---

## 2. Database Schema (for persistence and RAG)

When adding persistence or a separate backend, the following schema supports chat history and file metadata.

### 2.1 Conversations and messages

```sql
-- One row per conversation (session or thread)
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  title TEXT,
  agent_id TEXT NOT NULL,
  model TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- One row per message (user, assistant, or tool result)
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  role TEXT NOT NULL,  -- 'user' | 'assistant' | 'system' | 'tool'
  content TEXT NOT NULL,
  tool_call_id TEXT,
  tool_name TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id);
```

### 2.2 File metadata and RAG chunks

```sql
-- Uploaded files (path on disk or blob ref)
CREATE TABLE file_metadata (
  id TEXT PRIMARY KEY,
  conversation_id TEXT,
  original_name TEXT NOT NULL,
  mime_type TEXT,
  path_or_ref TEXT NOT NULL,
  size_bytes INTEGER,
  created_at INTEGER NOT NULL
);

-- For RAG: chunked and embedded content
CREATE TABLE document_chunks (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL REFERENCES file_metadata(id),
  chunk_index INTEGER NOT NULL,
  text TEXT NOT NULL,
  embedding BLOB,  -- or separate vector table depending on DB
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_chunks_file ON document_chunks(file_id);
```

Current implementation uses **in-memory state** only; the schema above is for a future persistence layer or standalone backend.

---

## 3. Multi-Agent Routing & System Prompts

The **Agent Selector** in the UI switches the active “agent” (persona + tool set). Each agent has:

- A **system prompt** (dynamic instructions)
- A **tool allow-list** (only these tools are exposed to the LLM and executed)

| Agent | System prompt focus | Tools |
|-------|---------------------|--------|
| **General Assistant** | ForeLLM context, hardware, models; general Q&A | `read_document`, `analyze_image`, `run_command` |
| **Data Analyst** | Data analysis, CSVs, charts, statistics | `read_document`, `run_command`, `execute_python` |
| **Web Researcher** | Real-time web info, citations | `web_search`, `read_document`, `run_command` |
| **Coding Expert** | Code generation, debugging, scripts | `read_document`, `run_command`, `execute_python` |

The backend receives the **agent_id** (or tool list) with each request and only executes tools that are allowed for that agent. System prompt is built in the frontend and sent as the first `system` message (or swapped per request).

---

## 4. Tool Calling Loop (Backend)

1. **Request**  
   Frontend sends to main process: `{ model, messages, tools }`.  
   `tools` is the JSON schema for the active agent’s tools (Ollama format).

2. **LLM call**  
   Main process calls Ollama `/api/chat` with `messages` and `tools`.  
   If streaming is used, main process streams chunks back and then parses the final message for tool_calls.

3. **Response handling**  
   - If the assistant message has **no** `tool_calls`: try **parseEchoedToolCalls(content)**; if the model echoed a tool call in text, run it and continue.  
   - If it has **tool_calls** (or parsed from echo):  
     - For **run_command**: return **pendingCommand** + **continueState** to the frontend; user sees Allow/Deny. On Allow, main runs the command and frontend calls **ollama:chatContinue** with the result.  
     - For other tools: run in main, append **tool** message: `{ role: 'tool', tool_name: name, content: result }` (Ollama expects `tool_name`, not `tool_call_id`).  
     - **normalizeMessagesForOllama** ensures `tool_calls[].function.arguments` is an object before each request (Ollama expects object, not JSON string).  
     - Append assistant + tool messages and call Ollama again; repeat until no tool_calls (or max rounds, e.g. 5).

4. **Execution**  
   - **web_search(query)** — Backend calls DuckDuckGo (or similar); returns text to the LLM.  
   - **read_document(file_id)** — Backend looks up the file in the file store, reads content (UTF-8 or binary placeholder), returns it. Use for text, JSON, CSV, SVG.  
   - **analyze_image(file_id)** — For uploaded images (PNG, JPEG, GIF, WebP). Backend sends the image to Ollama with a vision model (default `llava`; override via `OLLAMA_VISION_MODEL`), returns the description text to the LLM.  
   - **run_command(command)** — Returns a **pending** marker; frontend shows Allow/Deny. On Allow, **agent:runCommand** runs the command (shell). If the command starts with `forellm`, the binary path is resolved when not on PATH (FORELLM_PATH or `target/release/forellm`). Result is sent via **ollama:chatContinue**.  
   - **execute_python(code)** — Temp file, subprocess with timeout (e.g. 30s); return stdout + stderr. Missing modules (e.g. `requests`) get a hint in the error for the model.

   **Echoed tool calls:** If the model outputs tags in text instead of tool_calls, the backend parses them and runs the tool: `<run_command>...</run_command>`, `<read_document>file_id</read_document>`, `<analyze_image>file_id</analyze_image>`.

---

## 5. File Handling & Memory (Context)

### 5.1 Upload and store

- **Drag-and-drop zone** in the UI: accept PDF, CSV, TXT, and images.
- Files are sent to the main process (e.g. as base64 or buffer); main process writes them to a temp directory and stores `file_id → { path, name, mime }` in memory.
- Frontend keeps a list of **active file_ids** for the current conversation and sends them with the message (e.g. “Attached: file_id_1, file_id_2”) or injects “User has attached: [filename1, filename2]” into the user message so the model knows to use `read_document`.

### 5.2 RAG (optional later)

1. **Parse** — Extract text from PDF (e.g. pdf-parse), CSV (rows), TXT (raw), images (OCR if needed).
2. **Chunk** — Split into overlapping segments (e.g. 512 tokens with 64 overlap).
3. **Embed** — Call an embedding model (Ollama embed or external API) and store vectors.
4. **Retrieve** — On each user message, embed the query, run similarity search, and inject top-k chunks into the system or user context.
5. **Generate** — LLM generates the reply with the retrieved context.

Current implementation focuses on **read_document** (full or parsed text) without vector DB; RAG can be added once embedding and a vector store are integrated.

---

## 6. API Routes / IPC (Electron)

All Agent Fore ↔ main process communication is via IPC (no HTTP server inside the app).

| Channel | Direction | Purpose |
|---------|-----------|--------|
| `ollama:chat` | Renderer → Main | Send messages + tools; get assistant reply (non-streaming). |
| `ollama:chatStream` | Renderer → Main | Same as chat but stream: true; main sends **agent:streamDelta** (delta, done, startNewMessage) for real-time typing. |
| `ollama:chatContinue` | Renderer → Main | Resume after run_command: inject tool result and run one more Ollama round. |
| `ollama:listModels` | Renderer → Main | List Ollama models for the model selector. |
| `agent:uploadFile` | Renderer → Main | Upload a file (buffer + name); returns `file_id`. |
| `agent:readDocument` | Renderer → Main | Get content of a file by `file_id`. |
| (analyze_image) | Main (tool loop) | Image analysis via Ollama vision model; no direct IPC from renderer. |
| `agent:webSearch` | Renderer → Main | Run web_search(query). |
| `agent:executePython` | Renderer → Main | Run execute_python(code); returns { stdout, stderr }. |
| `agent:runCommand` | Renderer → Main | Run a shell command (after user Allow); returns { stdout, stderr }. |
| **agent:streamDelta** | Main → Renderer | Streaming: { delta, done, startNewMessage } for typing UI. |

The **tool-calling loop** runs in the main process. When the model (or echoed text) requests **run_command**, the loop returns **pendingCommand** + **continueState**; the frontend shows Allow/Deny, then calls **agent:runCommand** and **ollama:chatContinue** with the result.

---

## 7. Frontend Components (Summary)

- **Chat window** — Scrollable message list; user on right, assistant on left; Markdown and syntax-highlighted code blocks; tables (remark-gfm).
- **Agent selector** — Dropdown in the header: General Assistant, Data Analyst, Web Researcher, Coding Expert. Swaps system prompt and tool set.
- **Model selector** — Existing Ollama model dropdown.
- **Drag-and-drop file zone** — Above or beside the text input; shows list of attached files (name + remove). On send, file_ids are included so the backend can pass them to the context or to `read_document`.
- **Input area** — Textarea + Send button; optional: “Attached: file1, file2” in the user bubble.
- **Streaming** — Default: main uses `ollama:chatStream` (Ollama `stream: true`), parses NDJSON, sends **agent:streamDelta** for each content chunk. UI shows a live typing bubble with blinking cursor; multiple assistant messages (e.g. after tool runs) appear as separate bubbles.
- **Run command confirmation** — When the agent calls `run_command`, the UI shows a card with the command and Allow/Deny; on Allow, the command runs and the result is sent via **chatContinue**.
- **Agent reply buttons** — System prompt instructs the model to end a message with `BUTTONS: Yes, No` (or custom labels); the UI parses and shows buttons that send the label as the next user message.
- **File attachments in bubbles** — User messages store `attachedFileNames` and display them under the text; raw tool-call echoes are stripped from assistant bubbles.

This document describes the current implementation (agent selector, file zone, tools, run_command with confirmation, streaming, and tool-loop with Ollama message normalization).
