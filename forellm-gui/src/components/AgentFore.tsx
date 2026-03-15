import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import type { SystemInfo, ModelFit } from '../lib/types'
import { cn } from '../lib/types'
import { AGENTS, baseForellmContext } from '../lib/agentConfig'
import { Bot, Send, Loader2, AlertCircle, User, Paperclip, X, ChevronDown, ChevronUp, Settings2 } from 'lucide-react'
import { AgentForeToolbar } from './AgentForeToolbar'

interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  /** File names attached with this user message (shown in the bubble). */
  attachedFileNames?: string[]
}

interface AttachedFile {
  fileId: string
  name: string
}

interface ChatSession {
  id: string
  title: string
  messages: ChatMessage[]
}

interface Props {
  system: SystemInfo | null
  models: ModelFit[]
  contextLength: number
  loading: boolean
}

const AGENT_FORE_CACHE_KEY = 'forellm-agent-fore-cache'
const MAX_CACHED_SESSIONS = 30
const MAX_MESSAGES_PER_SESSION = 500

function newSessionId() {
  return `chat_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function loadAgentForeCache(): Partial<{
  sessions: ChatSession[]
  currentSessionId: string | null
  selectedAgentId: string
  backend: 'ollama' | 'openclaw'
  selectedModel: string
  openclawBaseUrl: string
}> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(AGENT_FORE_CACHE_KEY)
    if (!raw) return {}
    const data = JSON.parse(raw) as {
      sessions?: Array<{ id: string; title: string; messages: ChatMessage[] }>
      currentSessionId?: string | null
      selectedAgentId?: string
      backend?: 'ollama' | 'openclaw'
      selectedModel?: string
      openclawBaseUrl?: string
    }
    const sessions = data.sessions?.slice(0, MAX_CACHED_SESSIONS).map((s) => ({
      ...s,
      messages: (s.messages ?? []).slice(-MAX_MESSAGES_PER_SESSION)
    }))
    if (!sessions?.length) return {}
    return {
      sessions,
      currentSessionId: data.currentSessionId ?? sessions[0]?.id ?? null,
      selectedAgentId: data.selectedAgentId ?? 'general',
      backend: data.backend ?? 'ollama',
      selectedModel: data.selectedModel ?? '',
      openclawBaseUrl: data.openclawBaseUrl ?? ''
    }
  } catch {
    return {}
  }
}

function saveAgentForeCache(payload: {
  sessions: ChatSession[]
  currentSessionId: string | null
  selectedAgentId: string
  backend: 'ollama' | 'openclaw'
  selectedModel: string
  openclawBaseUrl: string
}) {
  if (typeof window === 'undefined') return
  try {
    const sessions = payload.sessions.slice(0, MAX_CACHED_SESSIONS).map((s) => ({
      id: s.id,
      title: s.title,
      messages: s.messages.slice(-MAX_MESSAGES_PER_SESSION)
    }))
    localStorage.setItem(
      AGENT_FORE_CACHE_KEY,
      JSON.stringify({
        sessions,
        currentSessionId: payload.currentSessionId,
        selectedAgentId: payload.selectedAgentId,
        backend: payload.backend,
        selectedModel: payload.selectedModel,
        openclawBaseUrl: payload.openclawBaseUrl
      })
    )
  } catch {
    // ignore quota or parse errors
  }
}

export function AgentFore({ system, models, contextLength }: Props) {
  const cached = loadAgentForeCache()
  const [sessions, setSessions] = useState<ChatSession[]>(() => cached.sessions ?? [{ id: newSessionId(), title: 'New chat', messages: [] }])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(() => cached.currentSessionId ?? null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [backend, setBackend] = useState<'ollama' | 'openclaw'>(() => cached.backend ?? 'ollama')
  const [ollamaModels, setOllamaModels] = useState<string[]>([])
  const [ollamaError, setOllamaError] = useState<string | null>(null)
  const [openclawModels, setOpenclawModels] = useState<string[]>([])
  const [openclawError, setOpenclawError] = useState<string | null>(null)
  const [openclawBaseUrl, setOpenclawBaseUrl] = useState(() => cached.openclawBaseUrl ?? '')
  const [selectedModel, setSelectedModel] = useState(() => cached.selectedModel ?? '')
  const [selectedAgentId, setSelectedAgentId] = useState(() => cached.selectedAgentId ?? 'general')
  const [toolbarOpen, setToolbarOpen] = useState(false)
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([])
  const [inputDragOver, setInputDragOver] = useState(false)
  const [showRenameInput, setShowRenameInput] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [pendingCommand, setPendingCommand] = useState<{ command: string; continueState: unknown } | null>(null)
  const [streamingContent, setStreamingContent] = useState<string | null>(null)
  const streamingBufferRef = useRef('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const bgRef = useRef<HTMLDivElement>(null)
  const [mouseBg, setMouseBg] = useState<{ x: number; y: number } | null>(null)

  function handleBgMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = bgRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setMouseBg({
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height
    })
  }
  function handleBgMouseLeave() {
    setMouseBg(null)
  }

  const currentSession = currentSessionId
    ? sessions.find((s) => s.id === currentSessionId)
    : sessions[0]
  const messages = currentSession?.messages ?? []
  const setMessages = (updater: (prev: ChatMessage[]) => ChatMessage[]) => {
    if (!currentSession) return
    setSessions((prev) =>
      prev.map((s) =>
        s.id === currentSession.id ? { ...s, messages: updater(s.messages) } : s
      )
    )
  }

  const agent = AGENTS.find((a) => a.id === selectedAgentId) ?? AGENTS[0]
  const systemPrompt = agent.buildSystemPrompt(
    baseForellmContext,
    system,
    models,
    contextLength,
    attachedFiles.map((f) => f.name)
  )
  const toolSchemas = agent.tools.length > 0 ? agent.tools : undefined

  useEffect(() => {
    if (typeof window === 'undefined' || !window.forellm?.listOllamaModels) return
    window.forellm.listOllamaModels().then((r) => {
      if (r.success && r.models?.length) {
        setOllamaModels(r.models)
        if (backend === 'ollama' && !selectedModel && r.models.length) setSelectedModel(r.models[0])
        setOllamaError(null)
      } else {
        setOllamaError(r.error || 'Ollama not running')
      }
    })
  }, [])

  useEffect(() => {
    if (backend !== 'openclaw' || typeof window === 'undefined' || !window.forellm?.listOpenClawModels) return
    const base = openclawBaseUrl.trim() || undefined
    window.forellm.listOpenClawModels(base).then((r) => {
      if (r.success && r.models?.length) {
        setOpenclawModels(r.models)
        if (!selectedModel && r.models.length) setSelectedModel(r.models[0])
        setOpenclawError(null)
      } else {
        setOpenclawModels(r.models?.length ? r.models : ['openclaw'])
        if (!selectedModel) setSelectedModel('openclaw')
        setOpenclawError(r.error ?? null)
      }
    })
  }, [backend, openclawBaseUrl])

  useEffect(() => {
    if (backend === 'ollama' && ollamaModels.length && !selectedModel) setSelectedModel(ollamaModels[0])
    if (backend === 'openclaw' && openclawModels.length && !selectedModel) setSelectedModel(openclawModels[0])
  }, [backend, ollamaModels, openclawModels, selectedModel])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, streamingContent])

  // When restored from cache (or after delete), ensure currentSessionId points to an existing session
  useEffect(() => {
    if (sessions.length === 0) return
    const exists = currentSessionId && sessions.some((s) => s.id === currentSessionId)
    if (!exists && sessions[0]) setCurrentSessionId(sessions[0].id)
  }, [sessions, currentSessionId])

  // Auto-save agent chat and settings to localStorage (debounced) and on unload
  useEffect(() => {
    const timer = setTimeout(() => {
      saveAgentForeCache({
        sessions,
        currentSessionId,
        selectedAgentId,
        backend,
        selectedModel,
        openclawBaseUrl
      })
    }, 800)
    return () => clearTimeout(timer)
  }, [sessions, currentSessionId, selectedAgentId, backend, selectedModel, openclawBaseUrl])

  useEffect(() => {
    const onBeforeUnload = () => {
      saveAgentForeCache({
        sessions,
        currentSessionId,
        selectedAgentId,
        backend,
        selectedModel,
        openclawBaseUrl
      })
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [sessions, currentSessionId, selectedAgentId, backend, selectedModel, openclawBaseUrl])

  /** Remove raw tool-call lines echoed by the model (e.g. read_document { "file_id": "..." }) so the bubble stays clean. */
  function stripToolCallEchoes(content: string): string {
    const toolNames = ['read_document', 'web_search', 'execute_python', 'run_command', 'analyze_image']
    const lineRe = new RegExp(`^\\s*(${toolNames.join('|')})\\s*\\{`)
    const toolCallLineRe = /tool_call_name\s+\w+\s+tool_call_arguments\s/
    const lines = content
      .split('\n')
      .filter((line) => !line.match(lineRe) && !line.match(toolCallLineRe))
    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
  }

  /**
   * Replace raw <execute_python>{ "code": "..." }</execute_python> (or similar) in displayed content
   * with a markdown fenced code block so code shows with proper line breaks and IDE-like formatting.
   */
  function formatExecutePythonBlocks(content: string): string {
    const tagRe = /<execute_python>([\s\S]*?)<\/execute_python>/gi
    return content.replace(tagRe, (_, inner) => {
      const trimmed = inner.trim()
      let code = trimmed
      if (trimmed.startsWith('{')) {
        try {
          const parsed = JSON.parse(trimmed) as { code?: string }
          if (typeof parsed?.code === 'string') code = parsed.code
        } catch {
          // leave code as trimmed
        }
      }
      return '\n```python\n' + code + '\n```\n'
    })
  }

  function exportChat(format: 'markdown' | 'txt', includeToolCalls: boolean) {
    const visible = messages.filter((m) => m.role !== 'system')
    if (visible.length === 0) return
    const lines: string[] = []
    const title = (currentSession?.title || 'ForeLLM Agent Fore Chat').replace(/[/\\?%*:|"<>]/g, '-')
    const ext = format === 'markdown' ? 'md' : 'txt'
    const date = new Date().toISOString().slice(0, 19).replace('T', ' ')
    for (const msg of visible) {
      const raw = msg.content
      const content = includeToolCalls ? raw : (msg.role === 'assistant' ? stripToolCallEchoes(raw) : raw)
      if (format === 'markdown') {
        if (msg.role === 'user') {
          lines.push('### User\n', content, '')
        } else {
          lines.push('### Assistant\n', content, '')
        }
      } else {
        lines.push(msg.role === 'user' ? 'User:' : 'Assistant:', '', content, '')
      }
    }
    const body = format === 'markdown'
      ? `# ${title}\n\nExported ${date}\n\n${lines.join('\n')}`
      : `${title}\nExported ${date}\n\n${lines.join('\n')}`
    const blob = new Blob([body], { type: format === 'markdown' ? 'text/markdown' : 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title}.${ext}`
    a.click()
    URL.revokeObjectURL(url)
  }

  function parseButtons(content: string): { content: string; buttons: string[] } {
    const cleaned = stripToolCallEchoes(content)
    const re = /\n\s*BUTTONS:\s*(.+)\s*$/i
    const m = cleaned.match(re)
    if (!m) return { content: cleaned, buttons: [] }
    const labels = m[1].split(',').map((s) => s.trim()).filter(Boolean)
    const contentWithout = cleaned.slice(0, m.index).trimEnd()
    return { content: contentWithout, buttons: labels }
  }

  async function runChatWithHistory(historyForApi: ChatMessage[]) {
    const isOpenClaw = backend === 'openclaw'
    const modelToUse = selectedModel || (isOpenClaw ? openclawModels[0] : ollamaModels[0])
    if (!modelToUse) {
      if (isOpenClaw) setOpenclawError('Select OpenClaw model or check gateway')
      else setOllamaError('Select an Ollama model or start Ollama')
      return
    }
    const streamApi = isOpenClaw
      ? (window.forellm?.chatOpenClawStream ?? window.forellm?.chatOpenClaw)
      : (window.forellm?.chatOllamaStream ?? window.forellm?.chatOllama)
    if (!streamApi) return
    setSending(true)
    if (isOpenClaw) setOpenclawError(null)
    else setOllamaError(null)
    streamingBufferRef.current = ''
    const useStream = isOpenClaw
      ? Boolean(window.forellm?.onAgentStreamDelta && window.forellm?.chatOpenClawStream)
      : Boolean(window.forellm?.onAgentStreamDelta && window.forellm?.chatOllamaStream)
    if (useStream) setStreamingContent('')

    if (useStream && window.forellm?.onAgentStreamDelta) {
      window.forellm.onAgentStreamDelta(({ delta, done, startNewMessage }) => {
        try {
          if (startNewMessage) {
            const toPush = streamingBufferRef.current
            if (toPush.trim()) {
              setMessages((prev) => [...prev, { role: 'assistant' as const, content: toPush }])
            }
            streamingBufferRef.current = ''
            setStreamingContent('')
            return
          }
          if (delta) {
            streamingBufferRef.current += delta
            setStreamingContent(streamingBufferRef.current)
          }
          if (done && !startNewMessage) {
            // Stream ended for this message; final content will be pushed on resolve or next startNewMessage
          }
        } catch (e) {
          console.error('AgentFore stream delta:', e)
          streamingBufferRef.current = ''
          setStreamingContent(null)
        }
      })
    }

    const baseUrl = isOpenClaw ? (openclawBaseUrl.trim() || undefined) : undefined
    const apiMessages = historyForApi.map((m) => ({ role: m.role, content: m.content }))
    try {
      const res = isOpenClaw
        ? (useStream
            ? await window.forellm!.chatOpenClawStream!(baseUrl, modelToUse, apiMessages, toolSchemas)
            : await window.forellm!.chatOpenClaw!(baseUrl, modelToUse, apiMessages, toolSchemas))
        : (useStream
            ? await window.forellm!.chatOllamaStream!(modelToUse, apiMessages, toolSchemas)
            : await window.forellm!.chatOllama!(modelToUse, apiMessages, toolSchemas))

      if (useStream) {
        const finalBuffer = streamingBufferRef.current.trim()
        if (res.pendingCommand) {
          // Main sent startNewMessage; listener will push. Defer clear so listener runs first and sees content.
          setTimeout(() => { streamingBufferRef.current = '' }, 0)
        } else {
          streamingBufferRef.current = ''
          if (finalBuffer) {
            setMessages((prev) => [...prev, { role: 'assistant' as const, content: finalBuffer }])
          }
        }
      }
      setStreamingContent(null)

      if (res.success) {
        if (!useStream && res.contents?.length) {
          setMessages((prev) => [...prev, ...res.contents!.map((c) => ({ role: 'assistant' as const, content: c }))])
        } else if (!useStream && res.content != null) {
          setMessages((prev) => [...prev, { role: 'assistant', content: res.content }])
        }
        if (res.pendingCommand?.command != null && res.continueState != null) {
          setPendingCommand({ command: res.pendingCommand.command, continueState: res.continueState })
        }
      } else {
        if (backend === 'openclaw') setOpenclawError(res.error || 'Request failed')
        else setOllamaError(res.error || 'Request failed')
        setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${res.error || 'unknown'}` }])
      }
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== currentSession?.id) return s
          const firstUser = s.messages.find((m) => m.role === 'user')
          const title = s.title === 'New chat' && firstUser
            ? (firstUser.content.slice(0, 36).trim() + (firstUser.content.length > 36 ? '…' : ''))
            : s.title
          return { ...s, title }
        })
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (backend === 'openclaw') setOpenclawError(msg)
      else setOllamaError(msg)
      setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${msg}` }])
      streamingBufferRef.current = ''
      setStreamingContent(null)
    } finally {
      setSending(false)
    }
  }

  async function send() {
    const text = input.trim()
    const isOpenClaw = backend === 'openclaw'
    const hasApi = isOpenClaw ? window.forellm?.chatOpenClaw : window.forellm?.chatOllama
    if (!text || sending || !hasApi) return
    const modelToUse = selectedModel || (isOpenClaw ? openclawModels[0] : ollamaModels[0])
    if (!modelToUse) {
      if (isOpenClaw) setOpenclawError('Select OpenClaw model or check gateway')
      else setOllamaError('Select an Ollama model or start Ollama')
      return
    }

    setInput('')
    const filesForApi = [...attachedFiles]
    setAttachedFiles([])
    const userMsg: ChatMessage = {
      role: 'user',
      content: text,
      attachedFileNames: filesForApi.length > 0 ? filesForApi.map((f) => f.name) : undefined
    }
    setMessages((prev) => [...prev, userMsg])

    const apiUserContent =
      filesForApi.length > 0
        ? `${text}\n\n[Attached files - use these file_ids with read_document: ${filesForApi.map((f) => `${f.fileId} -> "${f.name}"`).join(', ')}]`
        : text
    const fullHistoryForApi: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...messages,
      { role: 'user', content: apiUserContent }
    ]
    await runChatWithHistory(fullHistoryForApi)
  }

  async function sendReply(replyText: string) {
    const hasApi = backend === 'openclaw' ? window.forellm?.chatOpenClaw : window.forellm?.chatOllama
    if (sending || !hasApi) return
    const userMsg: ChatMessage = { role: 'user', content: replyText }
    setMessages((prev) => [...prev, userMsg])
    const fullHistoryForApi: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...messages,
      userMsg
    ]
    await runChatWithHistory(fullHistoryForApi)
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length || !window.forellm?.agentUploadFile) return
    for (const file of Array.from(files)) {
      const buf = await file.arrayBuffer()
      const r = await window.forellm.agentUploadFile({ buffer: buf, name: file.name, mime: file.type })
      if (r.success && r.fileId) setAttachedFiles((prev) => [...prev, { fileId: r.fileId!, name: file.name }])
    }
  }

  function removeAttachment(fileId: string) {
    setAttachedFiles((prev) => prev.filter((f) => f.fileId !== fileId))
  }

  async function handleCommandConfirm(allowed: boolean, pending: { command: string; continueState: unknown }) {
    setPendingCommand(null)
    setSending(true)
    const toolResult = allowed
      ? await (async () => {
          if (!window.forellm?.agentRunCommand) return 'Run command not available.'
          const r = await window.forellm.agentRunCommand(pending.command)
          if (r.success) return [r.stdout, r.stderr].filter(Boolean).join('\n') || '(no output)'
          return `Error: ${r.error ?? r.stderr ?? 'failed'}`
        })()
      : 'User denied the command.'
    try {
      const continueState = pending.continueState as { backend?: string }
      const isOpenClaw = continueState?.backend === 'openclaw'
      if (isOpenClaw) {
        if (!window.forellm?.chatOpenClawContinue) {
          setOpenclawError('Continue not available')
          setSending(false)
          return
        }
      } else {
        if (!window.forellm?.chatOllamaContinue) {
          setOllamaError('Continue not available')
          setSending(false)
          return
        }
      }
      const res = isOpenClaw
        ? await window.forellm!.chatOpenClawContinue(pending.continueState, toolResult)
        : await window.forellm!.chatOllamaContinue(pending.continueState as Parameters<typeof window.forellm.chatOllamaContinue>[0], toolResult)
      if (res.success) {
        const contents = res.contents
        if (Array.isArray(contents) && contents.length > 0) {
          setMessages((prev) => [...prev, ...contents.map((c) => ({ role: 'assistant' as const, content: c }))])
        } else if (res.content != null) {
          setMessages((prev) => [...prev, { role: 'assistant', content: res.content }])
        }
        if (res.pendingCommand?.command != null && res.continueState != null) {
          setPendingCommand({ command: res.pendingCommand.command, continueState: res.continueState })
        }
      } else {
        if (continueState?.backend === 'openclaw') setOpenclawError(res.error || 'Continue failed')
        else setOllamaError(res.error || 'Continue failed')
        setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${res.error ?? 'unknown'}` }])
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (continueState?.backend === 'openclaw') setOpenclawError(msg)
      else setOllamaError(msg)
      setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${msg}` }])
    } finally {
      setSending(false)
    }
  }

  function startNewChat() {
    const id = newSessionId()
    setSessions((prev) => [...prev, { id, title: 'New chat', messages: [] }])
    setCurrentSessionId(id)
  }

  function resetChat() {
    if (!currentSession) return
    setSessions((prev) =>
      prev.map((s) => (s.id === currentSession.id ? { ...s, messages: [] } : s))
    )
  }

  function removeCurrentChat() {
    if (!currentSession) return
    const idx = sessions.findIndex((s) => s.id === currentSession.id)
    const next = sessions.filter((s) => s.id !== currentSession.id)
    if (next.length === 0) {
      setSessions([{ id: newSessionId(), title: 'New chat', messages: [] }])
      setCurrentSessionId(null)
    } else {
      setSessions(next)
      setCurrentSessionId(next[Math.max(0, idx - 1)].id)
    }
  }

  function startRename() {
    if (!currentSession) return
    setRenameValue(currentSession.title)
    setShowRenameInput(true)
  }

  function saveRename() {
    const v = renameValue.trim()
    if (currentSession && v) {
      setSessions((prev) =>
        prev.map((s) => (s.id === currentSession.id ? { ...s, title: v } : s))
      )
    }
    setShowRenameInput(false)
  }

  const canSend = input.trim().length > 0 && (selectedModel || (backend === 'openclaw' ? openclawModels[0] : ollamaModels[0])) && !sending

  return (
    <div
      ref={bgRef}
      onMouseMove={handleBgMouseMove}
      onMouseLeave={handleBgMouseLeave}
      className="relative flex h-full w-full flex-col overflow-hidden bg-zinc-50 dark:bg-zinc-950"
    >
      {/* Emerald-only gradient */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-500/20 via-emerald-500/8 to-transparent dark:from-emerald-500/25 dark:via-emerald-500/12 dark:to-transparent" aria-hidden />
      {/* Wavy background: moves with mouse; viewBox/path extended so no clip at edges */}
      <div
        className="pointer-events-none absolute -inset-[30%] opacity-40 dark:opacity-30 transition-transform duration-200 ease-out"
        aria-hidden
        style={{
          transform: mouseBg
            ? `translate(${(mouseBg.x - 0.5) * 28}px, ${(mouseBg.y - 0.5) * 28}px)`
            : 'translate(0, 0)'
        }}
      >
        <svg className="agent-fore-wave absolute inset-0 h-full w-full" viewBox="-80 -40 820 440" preserveAspectRatio="none">
          <defs>
            <linearGradient id="agent-fore-wave-green" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgb(16 185 129)" stopOpacity="0.5" />
              <stop offset="100%" stopColor="rgb(16 185 129)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path fill="url(#agent-fore-wave-green)" d="M-80 120 Q0 80 120 120 T320 120 T520 120 T720 120 V400 H-80 Z" />
        </svg>
        <svg className="agent-fore-wave-slow absolute inset-0 h-full w-full" viewBox="-80 -40 820 440" preserveAspectRatio="none">
          <path fill="url(#agent-fore-wave-green)" d="M-80 140 Q0 100 120 140 T320 140 T520 140 T720 140 V400 H-80 Z" opacity="0.6" />
        </svg>
      </div>
      <div className="relative flex min-h-0 flex-1 flex-col">
        {/* Floating island: out of flow so chat uses full height; click outside to close */}
        <div className="absolute left-0 right-0 top-0 z-20 flex justify-center pt-3 px-4 pointer-events-none">
          {toolbarOpen && (
            <div
              className="fixed inset-0 z-20 pointer-events-auto bg-black/20 dark:bg-black/30 backdrop-blur-[1px]"
              aria-hidden
              onClick={() => setToolbarOpen(false)}
              role="presentation"
            />
          )}
          <div
            className={cn(
              'pointer-events-auto relative z-30 flex items-center rounded-xl border shadow-xl transition-shadow',
              'border-zinc-300/90 bg-white/90 dark:border-zinc-600/90 dark:bg-zinc-800/90',
              'backdrop-blur-md',
              toolbarOpen ? 'w-full max-w-4xl flex-wrap items-center gap-3 px-4 py-2.5' : 'py-2 px-3'
            )}
          >
            {toolbarOpen ? (
              <>
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
                  <AgentForeToolbar
                    agentId={selectedAgentId}
                    onAgentChange={setSelectedAgentId}
                    backend={backend}
                    onBackendChange={(b) => { setBackend(b); setSelectedModel('') }}
                    openclawBaseUrl={openclawBaseUrl}
                    onOpenClawBaseUrlChange={setOpenclawBaseUrl}
                    selectedModel={selectedModel}
                    onModelChange={setSelectedModel}
                    ollamaModels={ollamaModels}
                    openclawModels={openclawModels}
                    ollamaError={ollamaError}
                    openclawError={openclawError}
                    onExport={exportChat}
                    exportDisabled={messages.length === 0}
                    sessions={sessions.map((s) => ({ id: s.id, title: s.title }))}
                    currentSessionId={currentSessionId}
                    onSessionSelect={setCurrentSessionId}
                    onNewChat={startNewChat}
                    onResetChat={resetChat}
                    onRemoveChat={removeCurrentChat}
                    resetDisabled={!currentSession || messages.length === 0}
                    removeDisabled={!currentSession}
                    showRenameInput={showRenameInput}
                    renameValue={renameValue}
                    onRenameValueChange={setRenameValue}
                    onRenameSubmit={saveRename}
                    onRenameCancel={() => setShowRenameInput(false)}
                    onRenameClick={startRename}
                    renameDisabled={!currentSession}
                    variant="island"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setToolbarOpen(false)}
                  className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
                  title="Hide controls"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setToolbarOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-300/80 bg-white/90 px-3 py-2 text-xs font-medium text-zinc-600 shadow-md transition hover:border-zinc-400 hover:bg-white dark:border-zinc-600 dark:bg-zinc-800/90 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:bg-zinc-800"
                title="Show controls"
              >
                <Settings2 className="h-3.5 w-3.5" />
                Controls
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {(backend === 'ollama' ? ollamaError : openclawError) && (
        <div className="flex shrink-0 items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{backend === 'ollama' ? ollamaError : openclawError}</span>
          <span className="text-zinc-600 dark:text-zinc-500">
            {backend === 'ollama' ? 'Start Ollama/OpenClaw or pick a model to enable the agent.' : 'Start OpenClaw gateway (openclaw gateway --port 18789) or check URL.'}
          </span>
        </div>
      )}

      {/* Chat history - full height; top padding so floating Controls pill doesn't cover first line */}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto p-4 pt-14 space-y-4"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-zinc-600 dark:text-zinc-500">
            <Bot className="h-10 w-10 text-emerald-500/70 dark:text-emerald-500/50" />
            <p className="text-sm">Switch agents above: General, Data Analyst, Web Researcher, or Coding Expert.</p>
            <p className="text-[10px]">Attach files with the paperclip icon or drag onto the input.</p>
          </div>
        )}
        {(() => {
          const visible = messages.filter((m) => m.role !== 'system')
          return visible.map((msg, i) => {
            const isLast = i === visible.length - 1
            const assistantWithButtons = msg.role === 'assistant' && isLast ? parseButtons(msg.content) : null
            const rawAssistantContent =
              assistantWithButtons && assistantWithButtons.buttons.length > 0 ? assistantWithButtons.content : stripToolCallEchoes(msg.content)
            const displayContent =
              msg.role === 'assistant'
                ? formatExecutePythonBlocks(rawAssistantContent || '…')
                : msg.content
            const buttons = assistantWithButtons?.buttons ?? []
            return (
              <div key={i} className={cn('flex gap-3', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                {msg.role === 'assistant' && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
                    <Bot className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
                  </div>
                )}
                <div className="flex flex-col gap-2 max-w-[85%]">
                  <div
                    className={cn(
                      'rounded-lg px-3 py-2 text-sm',
                      msg.role === 'user'
                        ? 'bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200'
                        : 'bg-zinc-100 text-zinc-800 border border-zinc-200 dark:bg-zinc-800/80 dark:text-zinc-300 dark:border-zinc-700/80'
                    )}
                  >
                    {msg.role === 'user' ? (
                      <div className="space-y-1.5">
                        <pre className="whitespace-pre-wrap font-sans text-inherit">{msg.content}</pre>
                        {msg.attachedFileNames && msg.attachedFileNames.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 border-t border-zinc-300 pt-2 mt-2 dark:border-zinc-700/80">
                            {msg.attachedFileNames.map((name) => (
                              <span
                                key={name}
                                className="inline-flex items-center gap-1 rounded bg-zinc-300 px-2 py-0.5 text-[11px] text-zinc-600 dark:bg-zinc-700/60 dark:text-zinc-400"
                              >
                                <Paperclip className="h-3 w-3 shrink-0" />
                                {name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="markdown-chat [&_p]:my-1.5 [&_ul]:my-2 [&_ol]:my-2 [&_li]:ml-4 [&_strong]:font-semibold [&_strong]:text-zinc-800 dark:[&_strong]:text-zinc-200 [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_pre]:my-2 [&_pre]:rounded-md">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            code({ node, className, children, ...props }) {
                              const match = /language-(\w+)/.exec(className ?? '')
                              const code = String(children).replace(/\n$/, '')
                              return match ? (
                                <div className="overflow-x-auto rounded-md">
                                  <SyntaxHighlighter
                                    style={oneDark}
                                    PreTag="div"
                                    language={match[1]}
                                    customStyle={{ margin: 0, borderRadius: '6px', fontSize: '12px' }}
                                    codeTagProps={{ style: {} }}
                                  >
                                    {code}
                                  </SyntaxHighlighter>
                                </div>
                              ) : (
                                <code className="bg-zinc-200 text-emerald-700 font-mono text-xs dark:bg-zinc-800 dark:text-emerald-300" {...props}>
                                  {children}
                                </code>
                              )
                            },
                            strong: ({ children }) => <strong className="font-semibold text-zinc-800 dark:text-zinc-200">{children}</strong>,
                            a: ({ href, children }) => (
                              <a href={href} target="_blank" rel="noopener noreferrer" className="text-emerald-600 underline hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300">
                                {children}
                              </a>
                            )
                          }}
                        >
                          {displayContent}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                  {msg.role === 'assistant' && buttons.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {buttons.map((label) => (
                        <button
                          key={label}
                          type="button"
                          onClick={() => sendReply(label)}
                          disabled={sending}
                          className="rounded-lg border border-zinc-300 bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-800 transition hover:bg-zinc-200 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-300 dark:bg-zinc-700">
                    <User className="h-3.5 w-3.5 text-zinc-600 dark:text-zinc-400" />
                  </div>
                )}
              </div>
            )
          })
        })()}
        {streamingContent !== null && (
          <div className="flex gap-3 justify-start">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
              <Bot className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
            </div>
            <div className="max-w-[85%] rounded-lg border border-zinc-200 bg-zinc-100 px-3 py-2 text-sm text-zinc-800 dark:border-zinc-700/80 dark:bg-zinc-800/80 dark:text-zinc-300">
              <span className="whitespace-pre-wrap font-sans">{streamingContent || '\u00a0'}</span>
              <span className="inline-block w-0.5 h-4 ml-0.5 bg-emerald-500 dark:bg-emerald-400 animate-cursor-blink align-middle" aria-hidden />
            </div>
          </div>
        )}
        {sending && streamingContent === null && (
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-500 dark:text-emerald-400" />
            </div>
            <span className="text-sm text-zinc-600 dark:text-zinc-500">
              Agent is thinking
              <span className="inline-flex gap-0.5 ml-0.5">
                <span className="animate-typing-dot opacity-70">.</span>
                <span className="animate-typing-dot animate-typing-dot-2 opacity-70">.</span>
                <span className="animate-typing-dot animate-typing-dot-3 opacity-70">.</span>
              </span>
            </span>
          </div>
        )}
        {pendingCommand && (
          <div className="flex gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500/20">
              <AlertCircle className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
            </div>
            <div className="flex flex-col gap-2 rounded-lg border border-amber-500/30 bg-zinc-100 px-3 py-2 dark:bg-zinc-800/90">
              <p className="text-sm text-zinc-700 dark:text-zinc-300">Run this command?</p>
              <pre className="overflow-x-auto rounded bg-white px-2 py-1.5 font-mono text-xs text-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">{pendingCommand.command}</pre>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleCommandConfirm(true, pendingCommand)}
                  className="rounded bg-emerald-500/20 px-3 py-1.5 text-xs font-medium text-emerald-600 transition hover:bg-emerald-500/30 dark:text-emerald-400"
                >
                  Allow
                </button>
                <button
                  type="button"
                  onClick={() => handleCommandConfirm(false, pendingCommand)}
                  className="rounded bg-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
                >
                  Deny
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-zinc-200 p-4 dark:border-zinc-800">
        {attachedFiles.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {attachedFiles.map((f) => (
              <span
                key={f.fileId}
                className="inline-flex items-center gap-1 rounded bg-zinc-200 px-2 py-1 text-[10px] text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
              >
                {f.name}
                <button type="button" onClick={() => removeAttachment(f.fileId)} className="rounded p-0.5 hover:bg-zinc-300 dark:hover:bg-zinc-700">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div
          className={cn(
            'relative flex items-center gap-2 rounded-xl transition',
            inputDragOver ? 'border-2 border-dashed border-emerald-500/50' : 'border border-transparent'
          )}
          onDragOver={(e) => {
            e.preventDefault()
            e.dataTransfer.dropEffect = 'copy'
            setInputDragOver(true)
          }}
          onDragLeave={() => setInputDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setInputDragOver(false)
            onFiles(e.dataTransfer.files)
          }}
        >
          {/* Custom drag overlay */}
          {inputDragOver && (
            <div
              className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl border-2 border-emerald-500/60 bg-white/95 text-sm font-medium text-emerald-600 dark:bg-zinc-900/95 dark:text-emerald-400"
              aria-hidden
            >
              Drop to attach
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            accept="*/*"
            onChange={(e) => { onFiles(e.target.files); e.target.value = '' }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            title="Attach files"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            placeholder="Message Agent Fore… (or drag files here)"
            rows={1}
            className="h-11 min-w-0 flex-1 resize-none rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800 placeholder:text-zinc-500 outline-none focus:border-emerald-500/50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:placeholder:text-zinc-500"
            disabled={sending}
          />
          <button
            type="button"
            onClick={send}
            disabled={!canSend}
            className="flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-emerald-500/20 px-4 text-sm font-medium text-emerald-600 transition hover:bg-emerald-500/30 disabled:opacity-40 disabled:hover:bg-emerald-500/20 dark:text-emerald-400"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send
          </button>
        </div>
      </div>
      </div>
    </div>
  )
}
