#!/usr/bin/env npx tsx
/**
 * Agent Fore CLI — terminal chat with Ollama using the same agents and tools as the GUI.
 * Requires: Node 18+, forellm binary (cargo build --release), Ollama running.
 *
 * Usage:
 *   npx tsx cli/agent-cli.ts [--model MODEL] [--agent general|data|web|coding] [--file PATH ...]
 *   npm run agent -- [--model MODEL] [--agent general] [--file ./data.csv]
 */

import { createInterface } from 'readline'
import { spawn } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import type { AgentSystemInfo, AgentModelInfo } from '../src/lib/agentConfig'
import { AGENTS, baseForellmContext } from '../src/lib/agentConfig'

const OLLAMA_BASE = 'http://127.0.0.1:11434'
const PENDING_COMMAND_PREFIX = '__PENDING_COMMAND__:'

function printHelp(): void {
  const g = '\x1b[32m'
  const y = '\x1b[33m'
  const m = '\x1b[35m'
  const d = '\x1b[2m'
  const r = '\x1b[0m'
  const b = '\x1b[1m'
  process.stdout.write(
    `\n${b}${m}Agent Fore CLI — Commands${r}\n\n` +
      `  ${g}Chat${r}\n` +
      `    Type any message and press Enter to chat. The agent can use tools:\n` +
      `    read_document, web_search, execute_python, run_command (you confirm).\n\n` +
      `  ${g}/help${r}              Show this help.\n\n` +
      `  ${g}/quit${r}  ${y}/exit  /q${r}   Exit the CLI.\n\n` +
      `  ${g}/clear${r}  ${y}/new${r}        Clear the conversation (start fresh with same agent/model).\n\n` +
      `  ${g}/agent${r} [id]        Show current agent or switch: general, data, web, coding.\n` +
      `  ${g}/model${r} [name]      Show current model or switch Ollama model.\n` +
      `  ${g}/models${r}             List available Ollama models.\n\n` +
      `  ${g}/file${r} <path>       Attach a file (agent can read_document). Repeat to attach more.\n` +
      `  ${g}/files${r}              List attached files.\n\n` +
      `${d}Agents: general (ForeLLM + docs + run), data (+ Python), web (+ web_search), coding (+ Python).${r}\n\n`
  )
}

// --- Args: model is optional; if not set we auto-detect from Ollama (running or available)
let modelFromArg: string | null = null
let agentId = 'general'
const filePaths: string[] = []
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--model' && process.argv[i + 1]) {
    modelFromArg = process.argv[++i]
  } else if (process.argv[i] === '--agent' && process.argv[i + 1]) {
    agentId = process.argv[++i]
  } else if (process.argv[i] === '--file' && process.argv[i + 1]) {
    filePaths.push(process.argv[++i])
  }
}

// File store: file_id -> absolute path (CLI: we use path as id or a short id)
const fileIdToPath = new Map<string, string>()
const attachedFileNames: string[] = []
for (const p of filePaths) {
  const resolved = path.resolve(p)
  if (existsSync(resolved)) {
    const id = path.basename(resolved) + '_' + randomUUID().slice(0, 8)
    fileIdToPath.set(id, resolved)
    attachedFileNames.push(path.basename(resolved))
  } else {
    console.error('File not found:', p)
  }
}

// --- Ollama: detect currently running model, or first available
async function detectOllamaModel(): Promise<string | null> {
  try {
    const psRes = await fetch(`${OLLAMA_BASE}/api/ps`)
    if (psRes.ok) {
      const ps = (await psRes.json()) as { models?: Array<{ name?: string }> }
      const running = ps.models?.filter((m) => m.name) ?? []
      if (running.length > 0) return running[0].name ?? null
    }
  } catch {
    //
  }
  try {
    const tagsRes = await fetch(`${OLLAMA_BASE}/api/tags`)
    if (tagsRes.ok) {
      const tags = (await tagsRes.json()) as { models?: Array<{ name?: string }> }
      const list = tags.models?.filter((m) => m.name) ?? []
      if (list.length > 0) return list[0].name ?? null
    }
  } catch {
    //
  }
  return null
}

async function listOllamaModels(): Promise<string[]> {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`)
    if (!res.ok) return []
    const data = (await res.json()) as { models?: Array<{ name?: string }> }
    return (data.models ?? []).map((m) => m.name ?? '').filter(Boolean)
  } catch {
    return []
  }
}

function attachFile(filePath: string): { ok: boolean; error?: string; name?: string; id?: string } {
  const resolved = path.resolve(filePath)
  if (!existsSync(resolved)) return { ok: false, error: 'File not found' }
  const name = path.basename(resolved)
  const id = name + '_' + randomUUID().slice(0, 8)
  fileIdToPath.set(id, resolved)
  attachedFileNames.push(name)
  return { ok: true, name, id }
}

// --- Stylish banner (ANSI colors, box, optional spinner)
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  white: '\x1b[37m'
}

function clearLine(): void {
  process.stderr.write('\x1b[2K\r')
}

function drawBanner(modelName: string, agentName: string, fileCount: number): void {
  const w = 48
  const line = (c: string) => c.repeat(w)
  const truncate = (s: string, max: number) => (s.length <= max ? s : s.slice(0, max - 3) + '...')

  // Visible content must be exactly (w) chars between the pipes. "  " + "Model " (6) + m + "  •  " (5) + "Agent " (6) + a + spaces = 48
  // So 2 + 6 + m + 5 + 6 + a + spaces = 19 + m + a + spaces = 48  =>  m + a <= 29
  const maxModel = 17
  const maxAgent = 12
  const m = truncate(modelName, maxModel)
  const a = truncate(agentName, maxAgent)
  const modelAgentVisible = 2 + 6 + m.length + 5 + 6 + a.length
  const pad = w - modelAgentVisible

  process.stderr.write('\n')
  process.stderr.write(`${C.cyan}╭${line('─')}╮${C.reset}\n`)
  process.stderr.write(`${C.cyan}│${C.reset}${' '.repeat(w)}${C.cyan}│${C.reset}\n`)
  process.stderr.write(
    `${C.cyan}│${C.reset}  ${C.bold}${C.magenta} AGENT FORE CLI ${C.reset}${' '.repeat(w - 18)}${C.cyan}│${C.reset}\n`
  )
  process.stderr.write(`${C.cyan}│${C.reset}${' '.repeat(w)}${C.cyan}│${C.reset}\n`)
  process.stderr.write(
    `${C.cyan}│${C.reset}  ${C.dim}Model${C.reset} ${C.green}${m}${C.reset}  ${C.dim}•${C.reset}  ${C.dim}Agent${C.reset} ${C.yellow}${a}${C.reset}${' '.repeat(pad)}${C.cyan}│${C.reset}\n`
  )
  if (fileCount > 0) {
    const fileText = `Files attached: ${fileCount}`
    process.stderr.write(`${C.cyan}│${C.reset}  ${C.dim}${fileText}${C.reset}${' '.repeat(w - 2 - fileText.length)}${C.cyan}│${C.reset}\n`)
  }
  process.stderr.write(`${C.cyan}│${C.reset}${' '.repeat(w)}${C.cyan}│${C.reset}\n`)
  const footer = 'Type /help for commands • /quit to exit'
  process.stderr.write(`${C.cyan}│${C.reset}  ${C.dim}${footer}${C.reset}${' '.repeat(w - 2 - footer.length)}${C.cyan}│${C.reset}\n`)
  process.stderr.write(`${C.cyan}╰${line('─')}╯${C.reset}\n`)
  process.stderr.write('\n')
}

function spinnerFrame(i: number): string {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
  return frames[i % frames.length]
}

async function withSpinner<T>(message: string, fn: () => Promise<T>): Promise<T> {
  let i = 0
  const interval = setInterval(() => {
    clearLine()
    process.stderr.write(`${C.cyan}${spinnerFrame(i)}${C.reset} ${C.dim}${message}${C.reset}`)
    i++
  }, 80)
  try {
    return await fn()
  } finally {
    clearInterval(interval)
    clearLine()
  }
}

// --- Forellm binary
function findBinary(): string {
  if (process.env.FORELLM_PATH) return process.env.FORELLM_PATH
  const ext = process.platform === 'win32' ? '.exe' : ''
  const cliDir = path.resolve(__dirname, '..')
  const projectRoot = path.resolve(cliDir, '..')
  const candidates = [
    path.join(projectRoot, 'target', 'release', `forellm${ext}`),
    path.join(projectRoot, 'target', 'debug', `forellm${ext}`)
  ]
  for (const c of candidates) {
    if (existsSync(c)) return c
  }
  return `forellm${ext}`
}

function execForellm(args: string[]): Promise<string> {
  const binary = findBinary()
  return new Promise((resolve, reject) => {
    const proc = spawn(binary, args, { env: process.env })
    let stdout = ''
    let stderr = ''
    proc.stdout?.on('data', (d) => { stdout += d.toString() })
    proc.stderr?.on('data', (d) => { stderr += d.toString() })
    proc.on('close', (code) => {
      if (code !== 0) reject(new Error(stderr || `forellm exited ${code}`))
      else resolve(stdout)
    })
    proc.on('error', (err) => reject(err))
  })
}

async function getSystemInfo(): Promise<AgentSystemInfo | null> {
  try {
    const out = await execForellm(['system', '--json'])
    const data = JSON.parse(out) as { system?: Record<string, unknown> }
    const s = data.system
    if (!s) return null
    return {
      cpu_name: String(s.cpu_name ?? ''),
      cpu_cores: Number(s.cpu_cores ?? 0),
      total_ram_gb: Number(s.total_ram_gb ?? 0),
      has_gpu: Boolean(s.has_gpu ?? s.gpu_name),
      gpu_name: String(s.gpu_name ?? ''),
      gpu_vram_gb: Number(s.gpu_vram_gb ?? 0),
      backend: String(s.backend ?? ''),
      os: s.os != null ? String(s.os) : undefined,
      unified_memory: Boolean(s.unified_memory)
    }
  } catch {
    return null
  }
}

async function getModelFits(): Promise<AgentModelInfo[]> {
  try {
    const out = await execForellm(['fit', '--json', '--all', '-n', '50'])
    const data = JSON.parse(out) as { models?: Array<Record<string, unknown>> }
    const list = data.models ?? []
    return list.map((m) => ({
      name: String(m.name ?? ''),
      parameter_count: String(m.parameter_count ?? ''),
      fit_level: String(m.fit_level ?? ''),
      memory_required_gb: Number(m.memory_required_gb ?? 0),
      use_case: String(m.use_case ?? ''),
      context_length: Number(m.context_length ?? 0),
      run_mode: m.run_mode != null ? String(m.run_mode) : undefined,
      provider: m.provider != null ? String(m.provider) : undefined,
      is_moe: Boolean(m.is_moe)
    }))
  } catch {
    return []
  }
}

// --- Tools (same behavior as Electron main)
async function webSearch(query: string): Promise<string> {
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json`
    const res = await fetch(url)
    if (!res.ok) return `Search failed: ${res.status}`
    const data = (await res.json()) as { Abstract?: string; AbstractText?: string; RelatedTopics?: Array<{ Text?: string }> }
    const abstract = data.Abstract || data.AbstractText || ''
    const related = (data.RelatedTopics || []).slice(0, 5).map((t) => t.Text).filter(Boolean)
    return [abstract, ...related].filter(Boolean).join('\n') || 'No results found.'
  } catch (err) {
    return err instanceof Error ? err.message : String(err)
  }
}

function readDocument(fileId: string): string {
  const p = fileIdToPath.get(fileId)
  if (!p) return 'File not found (invalid file_id or not attached).'
  try {
    return readFileSync(p, 'utf8')
  } catch {
    try {
      const raw = readFileSync(p)
      return `[Binary file, ${raw.length} bytes]`
    } catch (err) {
      return err instanceof Error ? err.message : String(err)
    }
  }
}

function runCommand(cmd: string): Promise<{ stdout: string; stderr: string; ok: boolean }> {
  return new Promise((resolve) => {
    const shellCmd = process.platform === 'win32' ? 'cmd.exe' : '/bin/sh'
    const args = process.platform === 'win32' ? ['/c', cmd] : ['-c', cmd]
    const proc = spawn(shellCmd, args, { cwd: process.cwd(), timeout: 60_000, env: process.env })
    let stdout = ''
    let stderr = ''
    proc.stdout?.on('data', (d) => { stdout += d.toString() })
    proc.stderr?.on('data', (d) => { stderr += d.toString() })
    proc.on('close', (code) => resolve({ stdout, stderr, ok: code === 0 }))
    proc.on('error', (err) => resolve({ stdout: '', stderr: err.message, ok: false }))
  })
}

async function executePython(code: string): Promise<string> {
  const { writeFileSync } = await import('fs')
  const { tmpdir } = await import('os')
  const dir = path.join(tmpdir(), 'forellm-agent-uploads')
  if (!existsSync(dir)) await import('fs').then((fs) => fs.mkdirSync(dir, { recursive: true }))
  const scriptPath = path.join(dir, `run_${randomUUID()}.py`)
  writeFileSync(scriptPath, code)
  const python = process.platform === 'win32' ? 'python' : 'python3'
  return new Promise((resolve) => {
    const proc = spawn(python, [scriptPath], { cwd: dir, timeout: 30_000, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } })
    let stdout = ''
    let stderr = ''
    proc.stdout?.on('data', (d) => { stdout += d.toString() })
    proc.stderr?.on('data', (d) => { stderr += d.toString() })
    proc.on('close', () => resolve([stdout, stderr].filter(Boolean).join('\n')))
    proc.on('error', (err) => resolve(err.message))
  })
}

async function runAgentTool(name: string, argsJson: string): Promise<string> {
  let args: Record<string, unknown> = {}
  try {
    args = JSON.parse(argsJson || '{}')
  } catch {
    return 'Invalid arguments JSON'
  }
  if (name === 'web_search') return webSearch(String(args.query ?? ''))
  if (name === 'read_document') return readDocument(String(args.file_id ?? ''))
  if (name === 'execute_python') return executePython(String(args.code ?? ''))
  if (name === 'run_command') {
    const cmd = String(args.command ?? '').trim()
    if (!cmd) return 'run_command requires a non-empty "command" argument.'
    return PENDING_COMMAND_PREFIX + JSON.stringify({ command: cmd })
  }
  return `Unknown tool: ${name}`
}

// --- Ollama API
function normalizeMessages(messages: unknown[]): unknown[] {
  return messages.map((m) => {
    const msg = m as Record<string, unknown>
    const toolCalls = msg.tool_calls as Array<{ function?: { arguments?: string | Record<string, unknown> } }> | undefined
    if (!Array.isArray(toolCalls)) return m
    const normalized = toolCalls.map((tc) => {
      const fn = tc.function
      if (!fn) return tc
      let args = fn.arguments
      if (typeof args === 'string') {
        try {
          args = JSON.parse(args) as Record<string, unknown>
        } catch {
          args = {}
        }
      }
      return { ...tc, function: { ...fn, arguments: args ?? {} } }
    })
    return { ...msg, tool_calls: normalized }
  })
}

function parseEchoedToolCalls(content: string): Array<{ name: string; arguments: string }> {
  const results: Array<{ name: string; arguments: string }> = []
  const toolNames = ['read_document', 'web_search', 'execute_python', 'run_command']
  const re = /tool_call_name\s+(\w+)\s+tool_call_arguments\s+(\{[^]*?\})/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(content)) !== null) {
    try {
      JSON.parse(m[2])
      results.push({ name: m[1], arguments: m[2] })
    } catch {
      //
    }
  }
  for (const name of toolNames) {
    const nameRe = new RegExp(`\\b${name}\\s+(\\{[^]*?\\})`, 'gi')
    while ((m = nameRe.exec(content)) !== null) {
      try {
        if (!results.some((r) => r.arguments === m![1])) {
          JSON.parse(m[1])
          results.push({ name, arguments: m[1] })
        }
      } catch {
        //
      }
    }
  }
  return results
}

type ChatResult = {
  success: boolean
  content?: string
  contents?: string[]
  error?: string
  pendingCommand?: { command: string }
  continueState?: {
    model: string
    messages: unknown[]
    pendingToolCall: { id: string; name: string; arguments: string }
    tools?: unknown
  }
}

type ChatMessage = { role: string; content?: string; tool_calls?: unknown; tool_name?: string }
async function ollamaChat(
  modelName: string,
  messages: Array<ChatMessage>,
  tools: unknown[]
): Promise<ChatResult> {
  const maxRounds = 5
  let currentMessages = [...messages]
  const toolSchemas = tools.length > 0 ? tools : undefined
  const assistantContents: string[] = []

  for (let round = 0; round < maxRounds; round++) {
    const toSend = normalizeMessages(currentMessages)
    const body: Record<string, unknown> = {
      model: modelName,
      messages: toSend,
      stream: false
    }
    if (toolSchemas) body.tools = toolSchemas

    const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    if (!res.ok) {
      const t = await res.text()
      return { success: false, error: t || `Ollama ${res.status}` }
    }

    const data = (await res.json()) as {
      message?: { content?: string; tool_calls?: Array<{ id?: string; function?: { name?: string; arguments?: string } }> }
      error?: string
    }
    if (data.error) return { success: false, error: data.error }
    const msg = data.message
    if (!msg) return { success: false, error: 'No message in response' }

    const content = (msg.content ?? '').trim()
    if (content) assistantContents.push(content)

    let toolCalls = msg.tool_calls ?? []
    if (toolCalls.length === 0) {
      const echoed = parseEchoedToolCalls(content)
      if (echoed.length > 0) {
        toolCalls = echoed.map((e) => ({
          id: `call_${randomUUID()}`,
          function: { name: e.name, arguments: e.arguments }
        }))
      }
    }

    if (toolCalls.length === 0) {
      return assistantContents.length > 0
        ? { success: true, contents: assistantContents }
        : { success: true, content: '' }
    }

    currentMessages.push({
      role: 'assistant',
      content: msg.content ?? '',
      tool_calls: toolCalls
    })

    for (const tc of toolCalls) {
      const name = tc.function?.name ?? ''
      const argsStr = typeof tc.function?.arguments === 'string' ? tc.function.arguments : JSON.stringify(tc.function?.arguments ?? '{}')
      const result = await runAgentTool(name, argsStr)

      if (result.startsWith(PENDING_COMMAND_PREFIX)) {
        let command = ''
        try {
          command = (JSON.parse(result.slice(PENDING_COMMAND_PREFIX.length)) as { command?: string }).command ?? ''
        } catch {
          //
        }
        return {
          success: true,
          contents: assistantContents.length > 0 ? assistantContents : undefined,
          content: assistantContents[assistantContents.length - 1],
          pendingCommand: { command },
          continueState: {
            model: modelName,
            messages: currentMessages,
            pendingToolCall: { id: tc.id ?? '', name, arguments: argsStr },
            tools: toolSchemas
          }
        }
      }

      currentMessages.push({
        role: 'tool',
        tool_name: name,
        content: result
      })
    }
  }

  return assistantContents.length > 0 ? { success: true, contents: assistantContents } : { success: false, error: 'Tool loop exceeded max rounds' }
}

async function ollamaChatContinue(
  continueState: { model: string; messages: unknown[]; pendingToolCall: { name: string; arguments: string }; tools?: unknown },
  toolResult: string
): Promise<ChatResult> {
  const { model: modelName, messages, pendingToolCall, tools: toolSchemas } = continueState
  const currentMessages = normalizeMessages([...messages])
  ;(currentMessages as Record<string, unknown>[]).push({
    role: 'tool',
    tool_name: pendingToolCall.name,
    content: toolResult
  })

  const body: Record<string, unknown> = {
    model: modelName,
    messages: currentMessages,
    stream: false
  }
  if (toolSchemas) body.tools = toolSchemas

  const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!res.ok) {
    const t = await res.text()
    return { success: false, error: t || `Ollama ${res.status}` }
  }

  const data = (await res.json()) as {
    message?: { content?: string; tool_calls?: unknown[] }
    error?: string
  }
  if (data.error) return { success: false, error: data.error }
  const msg = data.message
  if (!msg) return { success: false, error: 'No message in response' }
  const content = (msg.content ?? '').trim()
  return { success: true, contents: content ? [content] : [] }
}

// --- Reply buttons: parse "BUTTONS: X, Y" from assistant message and show [1] X [2] Y
function parseReplyButtons(content: string): { text: string; buttons: string[] } {
  const match = content.match(/\n\s*BUTTONS:\s*(.+)$/i)
  if (!match) return { text: content, buttons: [] }
  const text = content.slice(0, content.length - match[0].length).trimEnd()
  const labels = match[1].split(',').map((s) => s.trim()).filter(Boolean)
  return { text, buttons: labels }
}

function printAgentReply(content: string): void {
  const { text, buttons } = parseReplyButtons(content)
  if (text) process.stdout.write('\nAgent: ' + text + '\n')
  if (buttons.length > 0) {
    const parts = buttons.map((b, i) => `  ${C.cyan}[${i + 1}]${C.reset} ${b}`).join('  ')
    process.stdout.write(parts + '\n')
  }
}

// --- Main loop
async function main() {
  let currentAgentId = agentId
  const agent = AGENTS.find((a) => a.id === currentAgentId) ?? AGENTS[0]

  let currentModel: string
  if (modelFromArg) {
    currentModel = modelFromArg
  } else {
    const detected = await withSpinner('Detecting Ollama model...', () => detectOllamaModel())
    if (!detected) {
      process.stderr.write(
        `${C.cyan}╭${'─'.repeat(48)}╮${C.reset}\n` +
          `${C.cyan}│${C.reset} ${C.yellow}No Ollama model detected.${C.reset}${' '.repeat(24)}${C.cyan}│${C.reset}\n` +
          `${C.cyan}│${C.reset} Run ${C.green}ollama run <model>${C.reset} (e.g. ollama run deepseek-v3)${' '.repeat(2)}${C.cyan}│${C.reset}\n` +
          `${C.cyan}│${C.reset} or pass ${C.green}--model <name>${C.reset} to use a specific model.${' '.repeat(6)}${C.cyan}│${C.reset}\n` +
          `${C.cyan}╰${'─'.repeat(48)}╯${C.reset}\n\n`
      )
      process.exit(1)
    }
    currentModel = detected as string
  }

  drawBanner(currentModel, agent.name, attachedFileNames.length)

  const systemInfo = await getSystemInfo()
  const modelFits = await getModelFits()
  const contextLength = 8192

  function getSystemPromptContent(): string {
    const a = AGENTS.find((x) => x.id === currentAgentId) ?? AGENTS[0]
    let sp = a.buildSystemPrompt(
      baseForellmContext,
      systemInfo,
      modelFits,
      contextLength,
      attachedFileNames
    )
    if (fileIdToPath.size > 0) {
      const mapping = [...fileIdToPath.entries()]
        .map(([id, p]) => `${path.basename(p)} → file_id "${id}"`)
        .join('; ')
      sp += `\n\nAttached file_ids for read_document: ${mapping}.`
    }
    return sp
  }

  const messages: Array<{ role: string; content?: string }> = [
    { role: 'system', content: getSystemPromptContent() }
  ]

  function replaceSystemMessage(): void {
    messages[0] = { role: 'system', content: getSystemPromptContent() }
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout })

  const ask = (): void => {
    rl.question('You> ', async (line) => {
      const input = line.trim()
      if (!input) {
        ask()
        return
      }

      if (input === '/quit' || input === '/exit' || input === '/q') {
        rl.close()
        process.exit(0)
      }

      if (input === '/help') {
        printHelp()
        ask()
        return
      }

      if (input === '/clear' || input === '/new') {
        messages.length = 0
        messages.push({ role: 'system', content: getSystemPromptContent() })
        process.stdout.write(`${C.dim}Chat cleared. Same agent & model.${C.reset}\n\n`)
        ask()
        return
      }

      if (input.startsWith('/agent')) {
        const rest = input.slice(6).trim()
        if (!rest) {
          const a = AGENTS.find((x) => x.id === currentAgentId) ?? AGENTS[0]
          process.stdout.write(`${C.dim}Current agent: ${C.yellow}${a.name}${C.reset} (${a.id})\n`)
        } else {
          const id = rest.toLowerCase()
          const a = AGENTS.find((x) => x.id === id)
          if (!a) {
            process.stdout.write(
              `${C.dim}Unknown agent. Use: general, data, web, coding${C.reset}\n`
            )
          } else {
            currentAgentId = a.id
            replaceSystemMessage()
            process.stdout.write(`${C.dim}Agent: ${C.yellow}${a.name}${C.reset}\n\n`)
          }
        }
        ask()
        return
      }

      if (input === '/models') {
        const list = await listOllamaModels()
        if (list.length === 0) process.stdout.write(`${C.dim}No Ollama models (or Ollama not reachable).${C.reset}\n`)
        else process.stdout.write(`${C.dim}Ollama models: ${C.green}${list.join(', ')}${C.reset}\n`)
        process.stdout.write('\n')
        ask()
        return
      }

      if (input.startsWith('/model')) {
        const rest = input.slice(6).trim()
        if (!rest) {
          process.stdout.write(`${C.dim}Current model: ${C.green}${currentModel}${C.reset}\n`)
        } else {
          currentModel = rest
          process.stdout.write(`${C.dim}Model: ${C.green}${currentModel}${C.reset}\n\n`)
        }
        ask()
        return
      }

      if (input.startsWith('/file')) {
        const filePath = input.slice(5).trim()
        if (!filePath) {
          process.stdout.write(`${C.dim}Usage: /file <path>${C.reset}\n`)
        } else {
          const r = attachFile(filePath)
          if (!r.ok) process.stdout.write(`${C.dim}${r.error}${C.reset}\n`)
          else {
            replaceSystemMessage()
            process.stdout.write(`${C.dim}Attached: ${C.green}${r.name}${C.reset}\n\n`)
          }
        }
        ask()
        return
      }

      if (input === '/files') {
        if (attachedFileNames.length === 0) process.stdout.write(`${C.dim}No files attached. Use /file <path>${C.reset}\n`)
        else process.stdout.write(`${C.dim}Attached: ${attachedFileNames.join(', ')}${C.reset}\n`)
        process.stdout.write('\n')
        ask()
        return
      }

      messages.push({ role: 'user', content: input })

      const currentAgent = AGENTS.find((a) => a.id === currentAgentId) ?? AGENTS[0]
      const tools = currentAgent.tools
      let result: ChatResult = await ollamaChat(currentModel, messages, tools)

      while (result.pendingCommand) {
        const cmd = result.pendingCommand.command
        process.stdout.write(`Run: ${cmd}\nAllow? [y/N]: `)
        const answer = await new Promise<string>((resolve) => {
          rl.question('', resolve)
        })
        const allowed = /^y|yes$/i.test(answer.trim())
        let toolResultText: string
        if (allowed) {
          const runRes = await runCommand(cmd)
          toolResultText = runRes.ok ? runRes.stdout || '(no output)' : runRes.stderr || 'Command failed'
        } else {
          toolResultText = 'User denied the command.'
        }
        result = await ollamaChatContinue(result.continueState!, toolResultText)
      }

      if (!result.success) {
        console.log('Error:', result.error)
      } else if (result.contents?.length) {
        for (const c of result.contents) {
          if (c) printAgentReply(c)
        }
        const last = result.contents[result.contents.length - 1]
        if (last) messages.push({ role: 'assistant', content: last })
      }
      process.stdout.write('\n')
      ask()
    })
  }

  ask()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
