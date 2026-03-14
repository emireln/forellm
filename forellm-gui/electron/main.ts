import { app, BrowserWindow, ipcMain, Menu, shell } from 'electron'
import { spawn } from 'child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { is } from '@electron-toolkit/utils'
import { randomUUID } from 'crypto'

let mainWindow: BrowserWindow | null = null

const agentUploadsDir = path.join(tmpdir(), 'forellm-agent-uploads')
const fileStore = new Map<string, { path: string; name: string; mime: string }>()

function ensureUploadsDir(): void {
  if (!existsSync(agentUploadsDir)) mkdirSync(agentUploadsDir, { recursive: true })
}

async function agentWebSearch(query: string): Promise<{ success: boolean; content?: string; error?: string }> {
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json`
    const res = await fetch(url)
    if (!res.ok) return { success: false, error: `Search ${res.status}` }
    const data = (await res.json()) as { Abstract?: string; AbstractText?: string; RelatedTopics?: Array<{ Text?: string }> }
    const abstract = data.Abstract || data.AbstractText || ''
    const related = (data.RelatedTopics || []).slice(0, 5).map((t: { Text?: string }) => t.Text).filter(Boolean)
    const content = [abstract, ...related].filter(Boolean).join('\n') || 'No results found.'
    return { success: true, content }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

function agentReadDocument(fileId: string): { success: boolean; content?: string; error?: string } {
  try {
    const entry = fileStore.get(fileId)
    if (!entry) return { success: false, error: 'File not found' }
    const raw = readFileSync(entry.path, 'utf8')
    return { success: true, content: raw }
  } catch {
    try {
      const entry = fileStore.get(fileId)
      if (!entry) return { success: false, error: 'File not found' }
      const raw = readFileSync(entry.path)
      return { success: true, content: `[Binary file: ${entry.name}, ${raw.length} bytes]` }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  }
}

const PENDING_COMMAND_PREFIX = '__PENDING_COMMAND__:'

async function agentRunCommand(command: string): Promise<{ success: boolean; stdout?: string; stderr?: string; error?: string }> {
  return new Promise((resolve) => {
    const shellCmd = process.platform === 'win32' ? 'cmd.exe' : '/bin/sh'
    const args = process.platform === 'win32' ? ['/c', command] : ['-c', command]
    const proc = spawn(shellCmd, args, {
      cwd: process.cwd(),
      timeout: 60_000,
      env: process.env
    })
    let stdout = ''
    let stderr = ''
    proc.stdout?.on('data', (d) => { stdout += d.toString() })
    proc.stderr?.on('data', (d) => { stderr += d.toString() })
    proc.on('close', (code) => {
      if (code !== 0) {
        resolve({ success: false, stderr: stderr || `Exit code ${code}`, stdout })
      } else {
        resolve({ success: true, stdout, stderr })
      }
    })
    proc.on('error', (err) => {
      resolve({ success: false, error: err.message })
    })
  })
}

async function agentExecutePython(
  code: string
): Promise<{ success: boolean; stdout?: string; stderr?: string; error?: string }> {
  try {
    ensureUploadsDir()
    const scriptPath = path.join(agentUploadsDir, `run_${randomUUID()}.py`)
    writeFileSync(scriptPath, code)
    const python = process.platform === 'win32' ? 'python' : 'python3'
    const result = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
      const proc = spawn(python, [scriptPath], {
        cwd: agentUploadsDir,
        timeout: 30_000,
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
      })
      let stdout = ''
      let stderr = ''
      proc.stdout?.on('data', (d) => { stdout += d.toString() })
      proc.stderr?.on('data', (d) => { stderr += d.toString() })
      proc.on('close', () => resolve({ stdout, stderr }))
      proc.on('error', reject)
    })
    return { success: true, stdout: result.stdout, stderr: result.stderr }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    const hint =
      /ModuleNotFoundError|No module named/i.test(errMsg)
        ? ' Tip: Use urllib.request (stdlib) for HTTP, or suggest: pip install requests beautifulsoup4.'
        : ''
    return { success: false, error: errMsg + hint }
  }
}

function findBinary(): string {
  if (process.env.FORELLM_PATH) return process.env.FORELLM_PATH

  const ext = process.platform === 'win32' ? '.exe' : ''
  const guiDir = path.resolve(__dirname, '..', '..')
  const projectRoot = path.resolve(guiDir, '..')

  const candidates = [
    path.join(projectRoot, 'target', 'release', `forellm${ext}`),
    path.join(projectRoot, 'target', 'debug', `forellm${ext}`)
  ]

  for (const c of candidates) {
    if (existsSync(c)) return c
  }

  return `forellm${ext}`
}

function execForellm(args: string[]): Promise<unknown> {
  const binary = findBinary()

  return new Promise((resolve, reject) => {
    const opts: SpawnOptions = {
      windowsHide: true,
      env: { ...process.env }
    }

    const proc = spawn(binary, args, opts)
    let stdout = ''
    let stderr = ''

    proc.stdout?.on('data', (d) => {
      stdout += d.toString()
    })
    proc.stderr?.on('data', (d) => {
      stderr += d.toString()
    })

    const timer = setTimeout(() => {
      proc.kill()
      reject(new Error('forellm timed out after 30 seconds'))
    }, 30_000)

    proc.on('close', (code) => {
      clearTimeout(timer)
      if (code !== 0) {
        reject(new Error(stderr.trim() || `forellm exited with code ${code}`))
        return
      }
      try {
        resolve(JSON.parse(stdout))
      } catch {
        reject(new Error(`Failed to parse forellm JSON output`))
      }
    })

    proc.on('error', (err) => {
      clearTimeout(timer)
      const e = err as NodeJS.ErrnoException
      if (e.code === 'ENOENT') {
        reject(
          new Error(
            `forellm binary not found.\n\n` +
              `Build it first:\n` +
              `  cd "${path.resolve(__dirname, '..', '..', '..')}" && cargo build --release\n\n` +
              `Or set FORELLM_PATH to the binary location.`
          )
        )
      } else {
        reject(err)
      }
    })
  })
}

/** Run forellm download (no JSON; stdout/stderr are progress output). Long timeout. */
function runForellmDownload(
  model: string,
  opts?: { quant?: string; list?: boolean }
): Promise<{ success: boolean; stdout: string; stderr: string }> {
  const binary = findBinary()
  const args: string[] = ['download', model]
  if (opts?.quant) args.push('--quant', opts.quant)
  if (opts?.list) args.push('--list')

  return new Promise((resolve) => {
    const proc = spawn(binary, args, { windowsHide: true, env: { ...process.env } })
    let stdout = ''
    let stderr = ''

    proc.stdout?.on('data', (d) => {
      stdout += d.toString()
    })
    proc.stderr?.on('data', (d) => {
      stderr += d.toString()
    })

    const timeoutMs = 600_000 // 10 minutes for large downloads
    const timer = setTimeout(() => {
      proc.kill()
      resolve({
        success: false,
        stdout,
        stderr: stderr + '\n[Timed out after 10 minutes]'
      })
    }, timeoutMs)

    proc.on('close', (code) => {
      clearTimeout(timer)
      resolve({
        success: code === 0,
        stdout,
        stderr
      })
    })

    proc.on('error', (err) => {
      clearTimeout(timer)
      const e = err as NodeJS.ErrnoException
      resolve({
        success: false,
        stdout: '',
        stderr: e.code === 'ENOENT' ? 'forellm binary not found. Build with: cargo build --release' : String(err)
      })
    })
  })
}

function registerIpc(): void {
  ipcMain.handle('forellm:system', async () => {
    return execForellm(['system', '--json'])
  })

  ipcMain.handle(
    'forellm:fit',
    async (
      _,
      opts?: {
        memory?: string
        ram?: string
        cores?: number
        maxContext?: number
        limit?: number
        sort?: string
      }
    ) => {
      const args: string[] = []
      if (opts?.memory) args.push('--memory', opts.memory)
      if (opts?.ram) args.push('--ram', opts.ram)
      if (opts?.cores != null && opts.cores > 0) args.push('--cores', String(opts.cores))
      if (opts?.maxContext) args.push('--max-context', String(opts.maxContext))
      args.push('fit', '--json', '--all')
      if (opts?.limit) args.push('-n', String(opts.limit))
      if (opts?.sort) args.push('--sort', opts.sort)
      return execForellm(args)
    }
  )

  ipcMain.handle(
    'forellm:recommend',
    async (_, opts?: { limit?: number; useCase?: string; minFit?: string }) => {
      const args: string[] = ['recommend', '--json']
      if (opts?.limit) args.push('--limit', String(opts.limit))
      if (opts?.useCase) args.push('--use-case', opts.useCase)
      if (opts?.minFit) args.push('--min-fit', opts.minFit)
      return execForellm(args)
    }
  )

  ipcMain.handle('forellm:info', async (_, model: string) => {
    return execForellm(['info', model, '--json'])
  })

  ipcMain.handle(
    'forellm:download',
    async (
      _,
      model: string,
      opts?: { quant?: string; list?: boolean }
    ) => {
      return runForellmDownload(model, opts)
    }
  )

  ipcMain.handle(
    'forellm:plan',
    async (
      _,
      model: string,
      opts?: { context?: number; quant?: string; targetTps?: number }
    ) => {
      const args = ['plan', model, '--json']
      if (opts?.context) args.push('--context', String(opts.context))
      if (opts?.quant) args.push('--quant', opts.quant)
      if (opts?.targetTps) args.push('--target-tps', String(opts.targetTps))
      return execForellm(args)
    }
  )

  ipcMain.handle('shell:openExternal', async (_, url: string) => {
    await shell.openExternal(url)
  })

  /** Run a single agent tool by name (used inside chat loop). */
  async function runAgentTool(
    name: string,
    argsJson: string
  ): Promise<string> {
    let args: Record<string, unknown> = {}
    try {
      args = JSON.parse(argsJson || '{}')
    } catch {
      return 'Invalid arguments JSON'
    }
    if (name === 'web_search') {
      const r = await agentWebSearch(String(args.query ?? ''))
      return r.success ? (r.content ?? '') : (r.error ?? 'Web search failed')
    }
    if (name === 'read_document') {
      const r = await agentReadDocument(String(args.file_id ?? ''))
      return r.success ? (r.content ?? '') : (r.error ?? 'Read document failed')
    }
    if (name === 'execute_python') {
      const r = await agentExecutePython(String(args.code ?? ''))
      if (!r.success) return r.error ?? 'Execution failed'
      return [r.stdout, r.stderr].filter(Boolean).join('\n')
    }
    if (name === 'run_command') {
      const cmd = String(args.command ?? '').trim()
      if (!cmd) return 'run_command requires a non-empty "command" argument.'
      return PENDING_COMMAND_PREFIX + JSON.stringify({ command: cmd })
    }
    return `Unknown tool: ${name}`
  }

  /** Extract a single top-level {...} starting at index; returns null or [jsonString, endIndex]. */
  function extractJsonObject(s: string, start: number): [string, number] | null {
    const i = s.indexOf('{', start)
    if (i === -1) return null
    let depth = 0
    let inString = false
    let escape = false
    let quote = ''
    for (let j = i; j < s.length; j++) {
      const c = s[j]
      if (escape) { escape = false; continue }
      if (c === '\\' && inString) { escape = true; continue }
      if (inString) {
        if (c === quote) inString = false
        continue
      }
      if (c === '"' || c === "'") { inString = true; quote = c; continue }
      if (c === '{') depth++
      else if (c === '}') {
        depth--
        if (depth === 0) return [s.slice(i, j + 1), j + 1]
      }
    }
    return null
  }

  /** Parse echoed tool calls from model content (e.g. "tool_call_name read_document tool_call_arguments {...}" or "read_document {...}"). */
  function parseEchoedToolCalls(content: string): Array<{ name: string; arguments: string }> {
    const results: Array<{ name: string; arguments: string }> = []
    const toolNames = ['read_document', 'web_search', 'execute_python', 'run_command']

    // Pattern 1: tool_call_name X tool_call_arguments { ... }
    const longRe = /tool_call_name\s+(\w+)\s+tool_call_arguments\s+/gi
    let m: RegExpExecArray | null
    while ((m = longRe.exec(content)) !== null) {
      const parsed = extractJsonObject(content, m.index + m[0].length)
      if (parsed) {
        try {
          JSON.parse(parsed[0])
          results.push({ name: m[1], arguments: parsed[0] })
        } catch {
          //
        }
      }
    }

    // Pattern 2: tool_name { ... } (e.g. read_document {"file_id": "..."})
    for (const name of toolNames) {
      const re = new RegExp(`\\b${name}\\s+`, 'gi')
      while ((m = re.exec(content)) !== null) {
        const parsed = extractJsonObject(content, m.index + m[0].length)
        if (parsed && !results.some((r) => r.arguments === parsed[0])) {
          try {
            JSON.parse(parsed[0])
            results.push({ name, arguments: parsed[0] })
          } catch {
            //
          }
        }
      }
    }
    return results
  }

  /** Stream Ollama chat: sends agent:streamDelta (delta, done, startNewMessage) and resolves with same shape as ollama:chat. */
  ipcMain.handle(
    'ollama:chatStream',
    async (
      event: Electron.IpcMainInvokeEvent,
      model: string,
      messages: Array<{ role: string; content: string }>,
      tools?: Array<{ type: string; function: { name: string; description: string; parameters?: object } }>
    ): Promise<{ success: boolean; content?: string; contents?: string[]; error?: string; pendingCommand?: { command: string }; continueState?: unknown }> => {
      const sender = event.sender
      const maxToolRounds = 5
      let currentMessages = [...messages]
      const toolSchemas = tools && tools.length > 0 ? tools : undefined
      const assistantContents: string[] = []

      const sendDelta = (delta: string, done: boolean, startNewMessage: boolean) => {
        sender.send('agent:streamDelta', { delta, done, startNewMessage })
      }

      for (let round = 0; round < maxToolRounds; round++) {
        try {
          const messagesToSend = normalizeMessagesForOllama(currentMessages)
          const body: { model: string; messages: unknown[]; stream: boolean; tools?: unknown } = {
            model,
            messages: messagesToSend,
            stream: true
          }
          if (toolSchemas) body.tools = toolSchemas

          const res = await fetch('http://127.0.0.1:11434/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          })
          if (!res.ok) {
            const t = await res.text()
            return { success: false, error: t || `Ollama ${res.status}` }
          }

          const reader = res.body?.getReader()
          const decoder = new TextDecoder()
          if (!reader) return { success: false, error: 'No response body' }

          let buffer = ''
          let fullContent = ''
          type ToolCallEntry = { id?: string; function?: { name?: string; arguments?: string } }
          const accumulatedToolCalls: ToolCallEntry[] = []

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
                  done?: boolean
                }
                if (data.message?.content != null) {
                  fullContent += data.message.content
                  sendDelta(data.message.content, false, false)
                }
                if (data.message?.tool_calls?.length) {
                  data.message.tool_calls.forEach((tc, i) => {
                    if (!accumulatedToolCalls[i]) accumulatedToolCalls[i] = { id: tc.id, function: { name: '', arguments: '' } }
                    const acc = accumulatedToolCalls[i].function!
                    if (tc.function?.name) acc.name = tc.function.name
                    if (tc.function?.arguments != null) acc.arguments = (acc.arguments || '') + tc.function.arguments
                  })
                }
                if (data.done) sendDelta('', true, false)
              } catch {
                // skip malformed line
              }
            }
          }
          if (buffer.trim()) {
            try {
              const data = JSON.parse(buffer.trim()) as {
                message?: { content?: string; tool_calls?: Array<{ id?: string; function?: { name?: string; arguments?: string } }> }
                done?: boolean
              }
              if (data.message?.content != null) {
                fullContent += data.message.content
                sendDelta(data.message.content, false, false)
              }
              if (data.message?.tool_calls?.length) {
                data.message.tool_calls.forEach((tc, i) => {
                  if (!accumulatedToolCalls[i]) accumulatedToolCalls[i] = { id: tc.id, function: { name: '', arguments: '' } }
                  const acc = accumulatedToolCalls[i].function!
                  if (tc.function?.name) acc.name = tc.function.name
                  if (tc.function?.arguments != null) acc.arguments = (acc.arguments || '') + tc.function.arguments
                })
              }
              sendDelta('', true, false)
            } catch {
              //
            }
          }

          const content = fullContent.trim()
          if (content) assistantContents.push(content)

          let toolCalls = accumulatedToolCalls.filter((tc) => tc.function?.name).map((tc) => ({
            id: tc.id ?? `call_${randomUUID()}`,
            function: { name: tc.function!.name!, arguments: tc.function!.arguments || '{}' }
          }))

          if (toolCalls.length === 0) {
            const echoed = parseEchoedToolCalls(content)
            if (echoed.length > 0) {
              toolCalls = echoed.map((e) => ({ id: `call_${randomUUID()}`, function: { name: e.name, arguments: e.arguments } }))
            }
          }

          if (toolCalls.length === 0) {
            if (!content && assistantContents.length > 0) {
              assistantContents.push('_(No further reply from the model. You can ask again.)_')
              sendDelta('_(No further reply from the model. You can ask again.)_', true, false)
            }
            return assistantContents.length > 0 ? { success: true, contents: assistantContents } : { success: true, content: '' }
          }

          currentMessages.push({
            role: 'assistant',
            content: fullContent || '',
            tool_calls: toolCalls
          } as Record<string, unknown>)
          sender.send('agent:streamDelta', { delta: '', done: true, startNewMessage: true })
          for (const tc of toolCalls) {
            const name = tc.function?.name ?? ''
            const argsStr = tc.function?.arguments ?? '{}'
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
                  model,
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
            } as Record<string, unknown>)
          }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err)
          return { success: false, error: errMsg }
        }
      }
      return assistantContents.length > 0 ? { success: true, contents: assistantContents } : { success: false, error: 'Tool loop exceeded max rounds' }
    }
  )

  /** Ollama chat with optional tool-calling loop. May return pendingCommand + continueState when agent calls run_command (user must confirm). */
  ipcMain.handle(
    'ollama:chat',
    async (
      _,
      model: string,
      messages: Array<{ role: string; content: string }>,
      tools?: Array<{ type: string; function: { name: string; description: string; parameters?: object } }>
    ): Promise<{
      success: boolean
      content?: string
      contents?: string[]
      error?: string
      pendingCommand?: { command: string }
      continueState?: { model: string; messages: unknown[]; pendingToolCall: { id: string; name: string; arguments: string }; tools?: unknown }
    }> => {
      const maxToolRounds = 5
      let currentMessages = [...messages]
      const toolSchemas = tools && tools.length > 0 ? tools : undefined
      const assistantContents: string[] = []

      for (let round = 0; round < maxToolRounds; round++) {
        try {
          const messagesToSend = normalizeMessagesForOllama(currentMessages)
          const body: { model: string; messages: unknown[]; stream: boolean; tools?: unknown } = {
            model,
            messages: messagesToSend,
            stream: false
          }
          if (toolSchemas) body.tools = toolSchemas

          const res = await fetch('http://127.0.0.1:11434/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          })
          if (!res.ok) {
            const t = await res.text()
            return { success: false, error: t || `Ollama ${res.status}` }
          }
          const data = (await res.json()) as {
            message?: {
              content?: string
              tool_calls?: Array<{ id?: string; function?: { name?: string; arguments?: string } }>
            }
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
              toolCalls = echoed.map((e) => ({ id: `call_${randomUUID()}`, function: { name: e.name, arguments: e.arguments } }))
            }
          }
          if (toolCalls.length === 0) {
            if (!content && assistantContents.length > 0) {
              assistantContents.push('_(No further reply from the model. You can ask again, e.g. “please create the scraper” or “continue”.)_')
            }
            return assistantContents.length > 0 ? { success: true, contents: assistantContents } : { success: true, content: '' }
          }

          currentMessages.push({
            role: 'assistant',
            content: msg.content ?? '',
            tool_calls: toolCalls
          } as Record<string, unknown>)
          for (const tc of toolCalls) {
            const name = tc.function?.name ?? ''
            const argsStr = tc.function?.arguments ?? '{}'
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
                  model,
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
            } as Record<string, unknown>)
          }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err)
          return { success: false, error: errMsg }
        }
      }
      return assistantContents.length > 0 ? { success: true, contents: assistantContents } : { success: false, error: 'Tool loop exceeded max rounds' }
    }
  )

  /** Normalize messages for Ollama: ensure tool_calls[].function.arguments is an object (Ollama expects object, not JSON string). */
  function normalizeMessagesForOllama(messages: unknown[]): unknown[] {
    return messages.map((m) => {
      const msg = m as Record<string, unknown>
      const toolCalls = msg.tool_calls as Array<{ function?: { name?: string; arguments?: string | Record<string, unknown> } }> | undefined
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

  /** Resume chat after user approved or denied a run_command. Injects tool result and runs one more Ollama round. */
  ipcMain.handle(
    'ollama:chatContinue',
    async (
      _,
      continueState: { model: string; messages: unknown[]; pendingToolCall: { id: string; name: string; arguments: string }; tools?: unknown },
      toolResult: string
    ): Promise<{ success: boolean; content?: string; contents?: string[]; error?: string; pendingCommand?: { command: string }; continueState?: unknown }> => {
      const { model, messages, pendingToolCall, tools: toolSchemas } = continueState
      const currentMessages = normalizeMessagesForOllama([...messages])
      currentMessages.push({
        role: 'tool',
        tool_name: pendingToolCall.name,
        content: toolResult
      } as Record<string, unknown>)
      try {
        const body: { model: string; messages: unknown[]; stream: boolean; tools?: unknown } = {
          model,
          messages: currentMessages,
          stream: false
        }
        if (toolSchemas) body.tools = toolSchemas
        const res = await fetch('http://127.0.0.1:11434/api/chat', {
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
        const assistantContents: string[] = content ? [content] : []
        const toolCalls = msg.tool_calls ?? []
        if (toolCalls.length === 0) {
          if (!content) {
            assistantContents.push('_(No further reply from the model. You can ask again, e.g. “please create the scraper” or “continue”.)_')
          }
          return assistantContents.length > 0 ? { success: true, contents: assistantContents } : { success: true, content: '' }
        }
        currentMessages.push({ role: 'assistant', content: msg.content ?? '', tool_calls: toolCalls } as Record<string, unknown>)
        for (const tc of toolCalls) {
          const name = tc.function?.name ?? ''
          const argsStr = tc.function?.arguments ?? '{}'
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
                model,
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
          } as Record<string, unknown>)
        }
        return { success: true, contents: assistantContents }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err)
        return { success: false, error: errMsg }
      }
    }
  )

  /** List Ollama models (GET /api/tags) for agent model selector. */
  ipcMain.handle(
    'ollama:listModels',
    async (): Promise<{ success: boolean; models?: string[]; error?: string }> => {
      try {
        const res = await fetch('http://127.0.0.1:11434/api/tags')
        if (!res.ok) return { success: false, error: `Ollama ${res.status}` }
        const data = (await res.json()) as { models?: Array<{ name: string }> }
        const names = (data.models ?? []).map((m) => m.name)
        return { success: true, models: names }
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) }
      }
    }
  )

  /** Agent: upload file; returns file_id. */
  ipcMain.handle(
    'agent:uploadFile',
    async (
      _,
      payload: { buffer: ArrayBuffer; name: string; mime?: string }
    ): Promise<{ success: boolean; fileId?: string; error?: string }> => {
      try {
        ensureUploadsDir()
        const fileId = randomUUID()
        const ext = path.extname(payload.name) || '.bin'
        const filePath = path.join(agentUploadsDir, `${fileId}${ext}`)
        const buf = Buffer.from(payload.buffer)
        writeFileSync(filePath, buf)
        fileStore.set(fileId, {
          path: filePath,
          name: payload.name,
          mime: payload.mime || 'application/octet-stream'
        })
        return { success: true, fileId }
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) }
      }
    }
  )

  ipcMain.handle('agent:readDocument', async (_, fileId: string) => agentReadDocument(fileId))
  ipcMain.handle('agent:webSearch', async (_, query: string) => agentWebSearch(query))
  ipcMain.handle('agent:executePython', async (_, code: string) => agentExecutePython(code))
  ipcMain.handle('agent:runCommand', async (_, command: string) => agentRunCommand(command))

  ipcMain.handle('window:minimize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.minimize()
  })
  ipcMain.handle('window:maximize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMaximized()) mainWindow.unmaximize()
      else mainWindow.maximize()
    }
  })
  ipcMain.handle('window:close', () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close()
  })
  ipcMain.handle('window:isMaximized', () => {
    return mainWindow != null && !mainWindow.isDestroyed() && mainWindow.isMaximized()
  })
}

function createWindow(): void {
  const guiRoot = path.resolve(__dirname, '..', '..')
  const repoRoot = path.join(guiRoot, '..')
  const publicLogo = path.join(guiRoot, 'public', 'forellm.png')
  const repoAssetsLogo = path.join(repoRoot, 'assets', 'forellm.png')
  const iconPath =
    existsSync(publicLogo) ? publicLogo
    : existsSync(repoAssetsLogo) ? repoAssetsLogo
    : publicLogo
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#09090b',
    icon: iconPath,
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
  mainWindow.on('maximize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('window:maximized')
  })
  mainWindow.on('unmaximize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('window:unmaximized')
  })
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  registerIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
