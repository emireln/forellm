#!/usr/bin/env npx tsx
/**
 * Agent Fore CLI — terminal chat with Ollama using the same agents and tools as the GUI.
 * Requires: Node 18+, forellm binary (cargo build --release). Backend: Ollama (default) or OpenClaw (openclaw gateway --port 18789).
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
      `  ${g}/model${r} [name]      Show current model or switch model (Ollama or OpenClaw).\n` +
      `  ${g}/models${r}             List available models for current backend.\n` +
      `  ${d}Start with --backend ollama (default) or --backend openclaw; --openclaw-url <url> for OpenClaw.${r}\n\n` +
      `  ${g}/file${r} <path>       Attach a file (agent can read_document). Repeat to attach more.\n` +
      `  ${g}/files${r}              List attached files.\n\n` +
      `${d}Agents: general (ForeLLM + docs + run), data (+ Python), web (+ web_search), coding (+ Python).${r}\n` +
      `${d}When the agent uses run_command (list dir, read file, etc.) you will be asked Allow? [y/N]; commands run in: ${process.cwd()}${r}\n\n`
  )
}

// --- Args: model optional (auto-detect for Ollama); backend ollama|openclaw; openclaw-url
let modelFromArg: string | null = null
let agentId = 'general'
let backendFromArg: 'ollama' | 'openclaw' = 'ollama'
let openclawUrlFromArg: string | null = null
const filePaths: string[] = []
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--model' && process.argv[i + 1]) {
    modelFromArg = process.argv[++i]
  } else if (process.argv[i] === '--agent' && process.argv[i + 1]) {
    agentId = process.argv[++i]
  } else if (process.argv[i] === '--backend' && process.argv[i + 1]) {
    const b = process.argv[++i].toLowerCase()
    if (b === 'openclaw' || b === 'ollama') backendFromArg = b
  } else if (process.argv[i] === '--openclaw-url' && process.argv[i + 1]) {
    openclawUrlFromArg = process.argv[++i]
  } else if (process.argv[i] === '--file' && process.argv[i + 1]) {
    filePaths.push(process.argv[++i])
  }
}

const OPENCLAW_BASE = openclawUrlFromArg ?? process.env.OPENCLAW_BASE_URL ?? 'http://127.0.0.1:18789'

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

async function listOpenClawModels(baseUrl: string): Promise<string[]> {
  try {
    const base = baseUrl.replace(/\/$/, '')
    const res = await fetch(`${base}/v1/models`, { headers: { 'x-openclaw-agent-id': 'main' } })
    if (!res.ok) return ['openclaw']
    const data = (await res.json()) as { data?: Array<{ id?: string }> }
    const ids = (data.data ?? []).map((m) => m.id ?? '').filter(Boolean)
    return ids.length > 0 ? ids : ['openclaw']
  } catch {
    return ['openclaw']
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
  blue: '\x1b[34m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  orange: '\x1b[38;5;208m',
  purple: '\x1b[35m',
  gray: '\x1b[90m',
  white: '\x1b[37m'
}
const AGENT_LABEL = `${C.purple}Agent:${C.reset} `
const PROMPT = `${C.cyan} │ ${C.reset}`
const STATUS_READY = `${C.orange}ready${C.reset}`
const STATUS_THINKING = `${C.orange}thinking${C.reset}`

/** Replace this with your ASCII art (multi-line). Used as the CLI title. */
const AGENT_FORE_ART = `
 █████╗  ██████╗ ███████╗███╗   ██╗████████╗    ███████╗ ██████╗ ██████╗ ███████╗
██╔══██╗██╔════╝ ██╔════╝████╗  ██║╚══██╔══╝    ██╔════╝██╔═══██╗██╔══██╗██╔════╝
███████║██║  ███╗█████╗  ██╔██╗ ██║   ██║       █████╗  ██║   ██║██████╔╝█████╗  
██╔══██║██║   ██║██╔══╝  ██║╚██╗██║   ██║       ██╔══╝  ██║   ██║██╔══██╗██╔══╝  
██║  ██║╚██████╔╝███████╗██║ ╚████║   ██║       ██║     ╚██████╔╝██║  ██║███████╗
╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═══╝   ╚═╝       ╚═╝      ╚═════╝ ╚═╝  ╚═╝╚══════╝                                                                                
`.trim()

function center(text: string, width: number): string {
  const n = Math.max(0, width - text.length)
  return ' '.repeat(Math.floor(n / 2)) + text + ' '.repeat(Math.ceil(n / 2))
}

function printTitle(): void {
  const lines = AGENT_FORE_ART.split('\n')
  const width = Math.max(...lines.map((l) => l.length), 56)
  for (const line of lines) {
    process.stderr.write(`${C.gray}${center(line, width)}${C.reset}\n`)
  }
}

function clearLine(): void {
  process.stderr.write('\x1b[2K\r')
}

function drawOpencodeStyle(modelName: string, agentName: string, fileCount: number): void {
  process.stderr.write('\n')
  printTitle()
  process.stderr.write('\n')
  process.stderr.write(
    `  ${C.dim}/help commands  /agent switch agent  /models list models${C.reset}\n`
  )
  process.stderr.write(`  ${C.orange}●${C.reset} ${C.dim}Tip Type /help for commands, /quit to exit${C.reset}\n\n`)
  if (fileCount > 0) {
    process.stderr.write(`  ${C.dim}Files attached: ${fileCount}${C.reset}\n\n`)
  }
}

function drawStatusLine(modelName: string, agentName: string, status: string, backend: 'ollama' | 'openclaw' = 'ollama'): void {
  const backendLabel = backend === 'openclaw' ? `${C.purple}OpenClaw${C.reset}` : `${C.cyan}Ollama${C.reset}`
  process.stdout.write(
    `  ${C.cyan}Chat${C.reset}  ${backendLabel}  ${C.green}${modelName}${C.reset}  ${C.yellow}${agentName}${C.reset}  ${status}\n`
  )
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

const IMAGE_EXT_CLI = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp'])

async function analyzeImage(fileId: string): Promise<string> {
  const p = fileIdToPath.get(fileId)
  if (!p) return 'File not found (invalid file_id or not attached).'
  const ext = path.extname(p).toLowerCase()
  if (!IMAGE_EXT_CLI.has(ext)) return 'Not an image file. Use read_document for text/SVG.'
  try {
    const buf = readFileSync(p)
    const base64 = buf.toString('base64')
    const visionModel = process.env.OLLAMA_VISION_MODEL ?? 'llava'
    const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: visionModel,
        messages: [{ role: 'user', content: 'Describe this image in detail. Include any text, objects, colors, and context that would help the user.' }],
        stream: false,
        images: [base64]
      })
    })
    if (!res.ok) {
      const t = await res.text()
      return t || `Ollama ${res.status}. Ensure a vision model is available (e.g. ollama pull llava).`
    }
    const data = (await res.json()) as { message?: { content?: string }; error?: string }
    if (data.error) return data.error
    const content = data.message?.content?.trim()
    return content ?? 'No description returned'
  } catch (err) {
    return err instanceof Error ? err.message : String(err)
  }
}

function resolveForellmInCommand(cmd: string): string {
  const binary = findBinary()
  if (!path.isAbsolute(binary)) return cmd
  const trimmed = cmd.trim()
  if (trimmed === 'forellm' || trimmed.startsWith('forellm ')) {
    return binary + trimmed.slice(7)
  }
  if (trimmed === 'forellm.exe' || trimmed.startsWith('forellm.exe ')) {
    return binary + trimmed.slice(11)
  }
  return cmd
}

function runCommand(cmd: string): Promise<{ stdout: string; stderr: string; ok: boolean }> {
  return new Promise((resolve) => {
    const resolvedCmd = resolveForellmInCommand(cmd)
    const cwd = process.cwd()
    const shellCmd = process.platform === 'win32' ? 'cmd.exe' : '/bin/sh'
    const args = process.platform === 'win32' ? ['/c', resolvedCmd] : ['-c', resolvedCmd]
    const proc = spawn(shellCmd, args, { cwd, timeout: 60_000, env: process.env, shell: false })
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
  if (name === 'analyze_image') return analyzeImage(String(args.file_id ?? ''))
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
  const toolNames = ['read_document', 'web_search', 'execute_python', 'run_command', 'analyze_image']

  // Fallback: <run_command>forellm fit --json --perfect</run_command> (model echoed command as text)
  const runCommandTagRe = /<run_command>([\s\S]*?)<\/run_command>/gi
  let m: RegExpExecArray | null
  while ((m = runCommandTagRe.exec(content)) !== null) {
    const cmd = m[1].trim()
    if (cmd) results.push({ name: 'run_command', arguments: JSON.stringify({ command: cmd }) })
  }
  // Fallback: <read_document>file_id</read_document> (model said it would read but echoed as text)
  const readDocTagRe = /<read_document>([\s\S]*?)<\/read_document>/gi
  while ((m = readDocTagRe.exec(content)) !== null) {
    const fileId = m[1].trim()
    if (fileId) results.push({ name: 'read_document', arguments: JSON.stringify({ file_id: fileId }) })
  }
  // Fallback: <analyze_image>file_id</analyze_image>
  const analyzeImageTagRe = /<analyze_image>([\s\S]*?)<\/analyze_image>/gi
  while ((m = analyzeImageTagRe.exec(content)) !== null) {
    const fileId = m[1].trim()
    if (fileId) results.push({ name: 'analyze_image', arguments: JSON.stringify({ file_id: fileId }) })
  }

  const re = /tool_call_name\s+(\w+)\s+tool_call_arguments\s+(\{[^]*?\})/gi
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
    backend?: 'openclaw'
    baseUrl?: string
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

/** One streaming round: POST with stream:true, read NDJSON, call onDelta for each content chunk, return fullContent + toolCalls. */
async function ollamaChatStreamRound(
  modelName: string,
  currentMessages: unknown[],
  toolSchemas: unknown[] | undefined,
  onDelta: (delta: string) => void
): Promise<{ ok: boolean; fullContent: string; toolCalls: Array<{ id?: string; function?: { name?: string; arguments?: string } }>; error?: string }> {
  const toSend = normalizeMessages(currentMessages)
  const body: Record<string, unknown> = {
    model: modelName,
    messages: toSend,
    stream: true
  }
  if (toolSchemas && toolSchemas.length > 0) body.tools = toolSchemas

  const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!res.ok) {
    const t = await res.text()
    return { ok: false, fullContent: '', toolCalls: [], error: t || `Ollama ${res.status}` }
  }

  const reader = res.body?.getReader()
  const decoder = new TextDecoder()
  if (!reader) return { ok: false, fullContent: '', toolCalls: [], error: 'No response body' }

  let buffer = ''
  let fullContent = ''
  type ToolEntry = { id?: string; function?: { name?: string; arguments?: string } }
  const accumulatedToolCalls: ToolEntry[] = []

  while (true) {
    const { done: streamDone, value } = await reader.read()
    if (streamDone) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        const data = JSON.parse(trimmed) as {
          message?: { content?: string; tool_calls?: Array<{ id?: string; function?: { name?: string; arguments?: string } }> }
        }
        if (data.message?.content != null) {
          fullContent += data.message.content
          onDelta(data.message.content)
        }
        if (data.message?.tool_calls?.length) {
          data.message.tool_calls.forEach((tc, i) => {
            if (!accumulatedToolCalls[i]) accumulatedToolCalls[i] = { id: tc.id, function: { name: '', arguments: '' } }
            const acc = accumulatedToolCalls[i].function!
            if (tc.function?.name) acc.name = tc.function.name
            if (tc.function?.arguments != null) acc.arguments = (acc.arguments || '') + tc.function.arguments
          })
        }
      } catch {
        // skip malformed line
      }
    }
  }
  if (buffer.trim()) {
    try {
      const data = JSON.parse(buffer.trim()) as {
        message?: { content?: string; tool_calls?: Array<{ id?: string; function?: { name?: string; arguments?: string } }> }
      }
      if (data.message?.content != null) {
        fullContent += data.message.content
        onDelta(data.message.content)
      }
      if (data.message?.tool_calls?.length) {
        data.message.tool_calls.forEach((tc, i) => {
          if (!accumulatedToolCalls[i]) accumulatedToolCalls[i] = { id: tc.id, function: { name: '', arguments: '' } }
          const acc = accumulatedToolCalls[i].function!
          if (tc.function?.name) acc.name = tc.function.name
          if (tc.function?.arguments != null) acc.arguments = (acc.arguments || '') + tc.function.arguments
        })
      }
    } catch {
      //
    }
  }

  const toolCalls = accumulatedToolCalls
    .filter((tc) => tc.function?.name)
    .map((tc) => ({
      id: tc.id ?? `call_${randomUUID()}`,
      function: { name: tc.function!.name!, arguments: tc.function!.arguments || '{}' }
    }))
  return { ok: true, fullContent, toolCalls }
}

/** Stream agent reply token-by-token. Uses same tool loop as ollamaChat; onDelta(delta) for each chunk, onNewMessage() before each new assistant turn after tools. */
async function ollamaChatStream(
  modelName: string,
  messages: Array<ChatMessage>,
  tools: unknown[],
  onDelta: (delta: string) => void,
  onNewMessage: () => void
): Promise<ChatResult> {
  const maxRounds = 5
  let currentMessages = [...messages]
  const toolSchemas = tools.length > 0 ? tools : undefined
  const assistantContents: string[] = []

  for (let round = 0; round < maxRounds; round++) {
    const { ok, fullContent, toolCalls: rawToolCalls, error } = await ollamaChatStreamRound(
      modelName,
      currentMessages,
      toolSchemas,
      onDelta
    )
    if (!ok) return { success: false, error: error ?? 'Stream round failed' }

    const content = fullContent.trim()
    if (content) assistantContents.push(content)

    let toolCalls = rawToolCalls
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
      return assistantContents.length > 0 ? { success: true, contents: assistantContents } : { success: true, content: '' }
    }

    currentMessages.push({
      role: 'assistant',
      content: fullContent || '',
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
    onNewMessage()
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

// --- OpenClaw (OpenAI-compatible /v1/chat/completions)
function toOpenAIMessages(messages: unknown[]): Array<{ role: string; content?: string; tool_calls?: Array<{ id: string; type: string; function: { name: string; arguments: string } }>; tool_call_id?: string }> {
  const out: Array<{ role: string; content?: string; tool_calls?: Array<{ id: string; type: string; function: { name: string; arguments: string } }>; tool_call_id?: string }> = []
  let lastToolCallIds: string[] = []
  for (const m of messages) {
    const msg = m as Record<string, unknown>
    const role = String(msg.role ?? '')
    if (role === 'system' || role === 'user') {
      out.push({ role, content: String(msg.content ?? '') })
      lastToolCallIds = []
      continue
    }
    if (role === 'assistant') {
      const toolCalls = msg.tool_calls as Array<{ id?: string; function?: { name?: string; arguments?: string } }> | undefined
      const openaiMsg: { role: string; content?: string; tool_calls?: Array<{ id: string; type: string; function: { name: string; arguments: string } }> } = {
        role: 'assistant',
        content: (String(msg.content ?? '')).trim() || undefined
      }
      if (Array.isArray(toolCalls) && toolCalls.length > 0) {
        lastToolCallIds = toolCalls.map((tc) => tc.id ?? `call_${randomUUID()}`)
        openaiMsg.tool_calls = toolCalls.map((tc) => ({
          id: tc.id ?? lastToolCallIds[lastToolCallIds.length - 1],
          type: 'function',
          function: {
            name: tc.function?.name ?? '',
            arguments: typeof tc.function?.arguments === 'string' ? tc.function.arguments : JSON.stringify(tc.function?.arguments ?? {})
          }
        }))
      } else {
        lastToolCallIds = []
      }
      out.push(openaiMsg)
      continue
    }
    if (role === 'tool') {
      const id = (msg.tool_call_id as string) ?? (lastToolCallIds.length > 0 ? lastToolCallIds.shift()! : `call_${randomUUID()}`)
      out.push({ role: 'tool', tool_call_id: id, content: String(msg.content ?? '') })
    }
  }
  return out
}

function toOpenAITools(tools: unknown[]): unknown[] {
  return (tools as Array<{ type: string; function: { name: string; description: string; parameters?: object } }>).map((t) => ({
    type: 'function',
    function: {
      name: t.function.name,
      description: t.function.description,
      parameters: t.function.parameters ?? { type: 'object', properties: {} }
    }
  }))
}

async function openclawChatStream(
  baseUrl: string,
  modelName: string,
  messages: Array<ChatMessage>,
  tools: unknown[],
  onDelta: (delta: string) => void,
  onNewMessage: () => void
): Promise<ChatResult> {
  const base = baseUrl.replace(/\/$/, '')
  const maxRounds = 5
  let currentMessages: unknown[] = [...messages]
  const toolSchemas = tools.length > 0 ? tools : undefined
  const assistantContents: string[] = []

  for (let round = 0; round < maxRounds; round++) {
    const body: { model: string; messages: unknown[]; stream: boolean; tools?: unknown } = {
      model: modelName || 'openclaw',
      messages: toOpenAIMessages(currentMessages),
      stream: true
    }
    if (toolSchemas) body.tools = toOpenAITools(toolSchemas)

    const res = await fetch(`${base}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-openclaw-agent-id': 'main'
      },
      body: JSON.stringify(body)
    })
    if (!res.ok) {
      const t = await res.text()
      return { success: false, error: t || `OpenClaw ${res.status}` }
    }
    const reader = res.body?.getReader()
    const decoder = new TextDecoder()
    if (!reader) return { success: false, error: 'No response body' }
    let buffer = ''
    let fullContent = ''
    const accumulatedToolCalls: Array<{ id: string; function: { name: string; arguments: string } }> = []

    while (true) {
      const { done: streamDone, value } = await reader.read()
      if (streamDone) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const payload = line.slice(6).trim()
          if (payload === '[DONE]') continue
          try {
            const data = JSON.parse(payload) as {
              choices?: Array<{ delta?: { content?: string; tool_calls?: Array<{ index?: number; id?: string; function?: { name?: string; arguments?: string } }> } }>
            }
            const delta = data.choices?.[0]?.delta
            if (delta?.content) {
              fullContent += delta.content
              onDelta(delta.content)
            }
            if (delta?.tool_calls?.length) {
              for (const tc of delta.tool_calls) {
                const i = tc.index ?? accumulatedToolCalls.length
                if (!accumulatedToolCalls[i]) accumulatedToolCalls[i] = { id: tc.id ?? `call_${randomUUID()}`, function: { name: '', arguments: '' } }
                if (tc.function?.name) accumulatedToolCalls[i].function.name = tc.function.name
                if (tc.function?.arguments != null) accumulatedToolCalls[i].function.arguments += tc.function.arguments
              }
            }
          } catch {
            //
          }
        }
      }
    }
    const content = fullContent.trim()
    if (content) assistantContents.push(content)
    const toolCalls = accumulatedToolCalls.filter((tc) => tc.function.name)

    if (toolCalls.length === 0) {
      return assistantContents.length > 0 ? { success: true, contents: assistantContents } : { success: true, content: '' }
    }
    currentMessages.push({
      role: 'assistant',
      content: fullContent || '',
      tool_calls: toolCalls.map((tc) => ({ id: tc.id, function: { name: tc.function.name, arguments: tc.function.arguments } }))
    })
    onNewMessage()
    for (const tc of toolCalls) {
      const name = tc.function.name
      const argsStr = tc.function.arguments ?? '{}'
      const result = await runAgentTool(name, argsStr)
      if (result.startsWith(PENDING_COMMAND_PREFIX)) {
        let command = ''
        try {
          command = (JSON.parse(result.slice(PENDING_COMMAND_PREFIX.length)) as { command?: string }).command ?? ''
        } catch {
          command = ''
        }
        return {
          success: true,
          contents: assistantContents.length > 0 ? assistantContents : undefined,
          content: assistantContents[assistantContents.length - 1],
          pendingCommand: { command },
          continueState: {
            backend: 'openclaw',
            baseUrl: base,
            model: modelName || 'openclaw',
            messages: currentMessages,
            pendingToolCall: { id: tc.id, name, arguments: argsStr },
            tools: toolSchemas
          }
        }
      }
      currentMessages.push({ role: 'tool', tool_call_id: tc.id, content: result })
    }
  }
  return assistantContents.length > 0 ? { success: true, contents: assistantContents } : { success: false, error: 'OpenClaw tool loop exceeded' }
}

async function openclawChatContinue(
  continueState: { baseUrl: string; model: string; messages: unknown[]; pendingToolCall: { id: string; name: string; arguments: string }; tools?: unknown },
  toolResult: string
): Promise<ChatResult> {
  const { baseUrl, model: modelName, messages, pendingToolCall, tools: toolSchemas } = continueState
  const base = baseUrl.replace(/\/$/, '')
  const currentMessages = [...messages] as Array<Record<string, unknown>>
  currentMessages.push({ role: 'tool', tool_call_id: pendingToolCall.id, content: toolResult })

  const body: { model: string; messages: unknown[]; stream: boolean; tools?: unknown } = {
    model: modelName || 'openclaw',
    messages: toOpenAIMessages(currentMessages),
    stream: false
  }
  if (toolSchemas) body.tools = toOpenAITools(toolSchemas as unknown[])

  const res = await fetch(`${base}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-openclaw-agent-id': 'main' },
    body: JSON.stringify(body)
  })
  if (!res.ok) {
    const t = await res.text()
    return { success: false, error: t || `OpenClaw ${res.status}` }
  }
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
  const msg = data.choices?.[0]?.message
  if (!msg) return { success: false, error: 'No message in OpenClaw response' }
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
  if (text) process.stdout.write(`\n${AGENT_LABEL}${text}\n`)
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
  if (backendFromArg === 'openclaw') {
    currentModel = modelFromArg || 'openclaw'
  } else if (modelFromArg) {
    currentModel = modelFromArg
  } else {
    const detected = await withSpinner('Detecting Ollama model...', () => detectOllamaModel())
    if (!detected) {
      process.stderr.write('\n')
      printTitle()
      process.stderr.write('\n')
      process.stderr.write(`  ${C.orange}No Ollama model detected.${C.reset}\n`)
      process.stderr.write(`  ${C.dim}Run ollama run <model> or pass --model <name> or --backend openclaw${C.reset}\n\n`)
      process.exit(1)
    }
    currentModel = detected as string
  }

  drawOpencodeStyle(currentModel, agent.name, attachedFileNames.length)

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
      sp += `\n\nAttached file_ids: use read_document for text/SVG, analyze_image for images (PNG, JPEG, GIF, WebP). ${mapping}.`
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
    const currentAgent = AGENTS.find((a) => a.id === currentAgentId) ?? AGENTS[0]
    drawStatusLine(currentModel, currentAgent.name, STATUS_READY, backendFromArg)
    rl.question(PROMPT, async (line) => {
      const input = (line || '').trim().replace(/\r/g, '')
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
        setImmediate(() => ask())
        return
      }

      if (input === '/clear' || input === '/new') {
        messages.length = 0
        messages.push({ role: 'system', content: getSystemPromptContent() })
        process.stdout.write(`${C.dim}Chat cleared. Same agent & model.${C.reset}\n\n`)
        setImmediate(() => ask())
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
        setImmediate(() => ask())
        return
      }

      if (input === '/models') {
        if (backendFromArg === 'openclaw') {
          const list = await listOpenClawModels(OPENCLAW_BASE)
          process.stdout.write(`${C.dim}OpenClaw models: ${C.green}${list.join(', ')}${C.reset}\n`)
        } else {
          const list = await listOllamaModels()
          if (list.length === 0) process.stdout.write(`${C.dim}No Ollama models (or Ollama not reachable).${C.reset}\n`)
          else process.stdout.write(`${C.dim}Ollama models: ${C.green}${list.join(', ')}${C.reset}\n`)
        }
        process.stdout.write('\n')
        setImmediate(() => ask())
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
        setImmediate(() => ask())
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
        setImmediate(() => ask())
        return
      }

      if (input === '/files') {
        if (attachedFileNames.length === 0) process.stdout.write(`${C.dim}No files attached. Use /file <path>${C.reset}\n`)
        else process.stdout.write(`${C.dim}Attached: ${attachedFileNames.join(', ')}${C.reset}\n`)
        process.stdout.write('\n')
        setImmediate(() => ask())
        return
      }

      messages.push({ role: 'user', content: input })

      const currentAgent = AGENTS.find((a) => a.id === currentAgentId) ?? AGENTS[0]
      const tools = currentAgent.tools
      process.stdout.write(`\n${C.yellow}You:${C.reset} ${input}\n`)
      drawStatusLine(currentModel, currentAgent.name, STATUS_THINKING, backendFromArg)
      process.stdout.write(`\n${AGENT_LABEL}`)
      let streamedThisTurn = true
      let result: ChatResult =
        backendFromArg === 'openclaw'
          ? await openclawChatStream(
              OPENCLAW_BASE,
              currentModel,
              messages,
              tools,
              (delta) => process.stdout.write(delta),
              () => process.stdout.write(`\n${AGENT_LABEL}`)
            )
          : await ollamaChatStream(
              currentModel,
              messages,
              tools,
              (delta) => process.stdout.write(delta),
              () => process.stdout.write(`\n${AGENT_LABEL}`)
            )

      while (result.pendingCommand) {
        const cmd = result.pendingCommand.command
        process.stdout.write(`\n${C.orange}Run:${C.reset} ${cmd}\n`)
        const answer = await new Promise<string>((resolve) => {
          rl.question(`${C.dim}Allow? [y/N]:${C.reset} `, resolve)
        })
        const allowed = /^y|yes$/i.test(answer.trim())
        let toolResultText: string
        if (allowed) {
          const runRes = await runCommand(cmd)
          toolResultText = runRes.ok ? runRes.stdout || '(no output)' : runRes.stderr || 'Command failed'
          const out = runRes.stdout?.trim() || ''
          const err = runRes.stderr?.trim() || ''
          if (out || err) {
            process.stdout.write(`${C.dim}Output:\n${C.reset}${out || err}\n`)
          } else if (runRes.ok) {
            process.stdout.write(`${C.dim}(command completed, no output)${C.reset}\n`)
          }
        } else {
          toolResultText = 'User denied the command.'
        }
        streamedThisTurn = false
        const continueState = result.continueState as { backend?: string }
        result =
          continueState?.backend === 'openclaw'
            ? await openclawChatContinue(continueState as Parameters<typeof openclawChatContinue>[0], toolResultText)
            : await ollamaChatContinue(result.continueState!, toolResultText)
      }

      if (!result.success) {
        process.stdout.write('\n')
        console.log('Error:', result.error)
      } else if (result.contents?.length) {
        if (streamedThisTurn) {
          process.stdout.write('\n')
          const last = result.contents[result.contents.length - 1]
          if (last) {
            const { buttons } = parseReplyButtons(last)
            if (buttons.length > 0) {
              const parts = buttons.map((b, i) => `  ${C.cyan}[${i + 1}]${C.reset} ${b}`).join('  ')
              process.stdout.write(parts + '\n')
            }
            messages.push({ role: 'assistant', content: last })
          }
        } else {
          for (const c of result.contents) {
            if (c) printAgentReply(c)
          }
          const last = result.contents[result.contents.length - 1]
          if (last) messages.push({ role: 'assistant', content: last })
        }
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
