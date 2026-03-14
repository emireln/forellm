import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import type { SystemInfo, ModelFit } from '../lib/types'
import { cn } from '../lib/types'
import { AGENTS, baseForellmContext } from '../lib/agentConfig'
import { Bot, Send, Loader2, AlertCircle, User, Paperclip, X, MessageSquarePlus, RotateCcw, Trash2, History, Pencil, Check } from 'lucide-react'

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

function newSessionId() {
  return `chat_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export function AgentFore({ system, models, contextLength }: Props) {
  const [sessions, setSessions] = useState<ChatSession[]>(() => [
    { id: newSessionId(), title: 'New chat', messages: [] }
  ])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(() => null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [ollamaModels, setOllamaModels] = useState<string[]>([])
  const [ollamaError, setOllamaError] = useState<string | null>(null)
  const [selectedModel, setSelectedModel] = useState('')
  const [selectedAgentId, setSelectedAgentId] = useState('general')
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([])
  const [inputDragOver, setInputDragOver] = useState(false)
  const [showHistoryOpen, setShowHistoryOpen] = useState(false)
  const [showRenameInput, setShowRenameInput] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [pendingCommand, setPendingCommand] = useState<{ command: string; continueState: unknown } | null>(null)
  const [streamingContent, setStreamingContent] = useState<string | null>(null)
  const streamingBufferRef = useRef('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

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
        if (!selectedModel && r.models.length) setSelectedModel(r.models[0])
        setOllamaError(null)
      } else {
        setOllamaError(r.error || 'Ollama not running')
      }
    })
  }, [])

  useEffect(() => {
    if (ollamaModels.length && !selectedModel) setSelectedModel(ollamaModels[0])
  }, [ollamaModels, selectedModel])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, streamingContent])

  /** Remove raw tool-call lines echoed by the model (e.g. read_document { "file_id": "..." }) so the bubble stays clean. */
  function stripToolCallEchoes(content: string): string {
    const toolNames = ['read_document', 'web_search', 'execute_python', 'run_command']
    const lineRe = new RegExp(`^\\s*(${toolNames.join('|')})\\s*\\{`)
    const toolCallLineRe = /tool_call_name\s+\w+\s+tool_call_arguments\s/
    const lines = content
      .split('\n')
      .filter((line) => !line.match(lineRe) && !line.match(toolCallLineRe))
    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
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
    const streamApi = window.forellm?.chatOllamaStream ?? window.forellm?.chatOllama
    if (!streamApi) return
    const modelToUse = selectedModel || ollamaModels[0]
    if (!modelToUse) {
      setOllamaError('Select an Ollama model or start Ollama')
      return
    }
    setSending(true)
    setOllamaError(null)
    streamingBufferRef.current = ''
    const useStream = Boolean(window.forellm?.onAgentStreamDelta && window.forellm?.chatOllamaStream)
    if (useStream) setStreamingContent('')

    if (useStream && window.forellm?.onAgentStreamDelta) {
      window.forellm.onAgentStreamDelta(({ delta, done, startNewMessage }) => {
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
      })
    }

    try {
      const res = useStream
        ? await window.forellm.chatOllamaStream!(
            modelToUse,
            historyForApi.map((m) => ({ role: m.role, content: m.content })),
            toolSchemas
          )
        : await window.forellm.chatOllama!(
            modelToUse,
            historyForApi.map((m) => ({ role: m.role, content: m.content })),
            toolSchemas
          )

      if (useStream) {
        const finalBuffer = streamingBufferRef.current.trim()
        if (finalBuffer) {
          setMessages((prev) => [...prev, { role: 'assistant' as const, content: finalBuffer }])
        }
        streamingBufferRef.current = ''
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
        setOllamaError(res.error || 'Request failed')
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
      setOllamaError(msg)
      setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${msg}` }])
      streamingBufferRef.current = ''
      setStreamingContent(null)
    } finally {
      setSending(false)
    }
  }

  async function send() {
    const text = input.trim()
    if (!text || sending || !window.forellm?.chatOllama) return
    const modelToUse = selectedModel || ollamaModels[0]
    if (!modelToUse) {
      setOllamaError('Select an Ollama model or start Ollama')
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
    if (sending || !window.forellm?.chatOllama) return
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
      if (!window.forellm?.chatOllamaContinue) {
        setOllamaError('Continue not available')
        setSending(false)
        return
      }
      const res = await window.forellm.chatOllamaContinue(pending.continueState as Parameters<typeof window.forellm.chatOllamaContinue>[0], toolResult)
      if (res.success) {
        if (res.contents?.length) {
          setMessages((prev) => [...prev, ...res.contents.map((c) => ({ role: 'assistant' as const, content: c }))])
        } else if (res.content != null) {
          setMessages((prev) => [...prev, { role: 'assistant', content: res.content }])
        }
        if (res.pendingCommand?.command != null && res.continueState != null) {
          setPendingCommand({ command: res.pendingCommand.command, continueState: res.continueState })
        }
      } else {
        setOllamaError(res.error || 'Continue failed')
        setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${res.error ?? 'unknown'}` }])
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setOllamaError(msg)
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

  const canSend = input.trim().length > 0 && (selectedModel || ollamaModels[0]) && !sending

  return (
    <div className="flex h-full flex-col bg-zinc-950">
      {/* Toolbar */}
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-zinc-800 px-4 py-2">
        <Bot className="h-3.5 w-3.5 text-emerald-400" />
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Agent Fore
        </span>
        <div className="flex items-center gap-2">
          <label className="text-[10px] text-zinc-500">Agent:</label>
          <select
            value={selectedAgentId}
            onChange={(e) => setSelectedAgentId(e.target.value)}
            className="agent-fore-select min-w-[140px]"
            title={agent.description}
          >
            {AGENTS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[10px] text-zinc-500">Model:</label>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="agent-fore-select min-w-[160px]"
          >
            {ollamaModels.length === 0 && (
              <option value="">{ollamaError || 'Loading…'}</option>
            )}
            {ollamaModels.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={startNewChat}
            className="rounded p-1.5 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300"
            title="Start new chat"
          >
            <MessageSquarePlus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={resetChat}
            disabled={!currentSession || messages.length === 0}
            className="rounded p-1.5 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300 disabled:opacity-40"
            title="Reset chat"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={removeCurrentChat}
            disabled={!currentSession}
            className="rounded p-1.5 text-zinc-500 transition hover:bg-zinc-800 hover:text-red-400 disabled:opacity-40"
            title="Remove chat"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          {showRenameInput ? (
            <div className="flex items-center gap-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1">
              <input
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveRename()
                  if (e.key === 'Escape') setShowRenameInput(false)
                }}
                className="w-36 rounded bg-transparent px-1.5 py-0.5 text-xs text-zinc-200 outline-none placeholder:text-zinc-500"
                placeholder="Chat name"
                autoFocus
              />
              <button
                type="button"
                onClick={saveRename}
                className="rounded p-1 text-emerald-400 transition hover:bg-zinc-800"
                title="Save"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={startRename}
              disabled={!currentSession}
              className="rounded p-1.5 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300 disabled:opacity-40"
              title="Rename chat"
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowHistoryOpen((o) => !o)}
              className="flex items-center gap-1 rounded p-1.5 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300"
              title="Previous chats"
            >
              <History className="h-4 w-4" />
            </button>
            {showHistoryOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowHistoryOpen(false)} aria-hidden />
                <div className="absolute right-0 top-full z-20 mt-1.5 max-h-60 min-w-[200px] overflow-auto rounded-xl border border-zinc-700 bg-zinc-900/95 py-1.5 shadow-xl shadow-black/30 ring-1 ring-zinc-800">
                  {sessions.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => { setCurrentSessionId(s.id); setShowHistoryOpen(false) }}
                      className={cn(
                        'w-full px-3 py-2.5 text-left text-xs transition',
                        currentSession?.id === s.id
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'text-zinc-300 hover:bg-zinc-800 hover:text-zinc-200'
                      )}
                    >
                      {s.title}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {ollamaError && (
        <div className="flex shrink-0 items-center gap-2 border-b border-amber-900/50 bg-amber-950/30 px-4 py-2 text-xs text-amber-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{ollamaError}</span>
          <span className="text-zinc-500">Start Ollama or pick a model to enable the agent.</span>
        </div>
      )}

      {/* Chat history */}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-zinc-500">
            <Bot className="h-10 w-10 text-emerald-500/50" />
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
              msg.role === 'assistant' ? (rawAssistantContent || '…') : msg.content
            const buttons = assistantWithButtons?.buttons ?? []
            return (
              <div key={i} className={cn('flex gap-3', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                {msg.role === 'assistant' && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
                    <Bot className="h-3.5 w-3.5 text-emerald-400" />
                  </div>
                )}
                <div className="flex flex-col gap-2 max-w-[85%]">
                  <div
                    className={cn(
                      'rounded-lg px-3 py-2 text-sm',
                      msg.role === 'user'
                        ? 'bg-zinc-800 text-zinc-200'
                        : 'bg-zinc-800/80 text-zinc-300 border border-zinc-700/80'
                    )}
                  >
                    {msg.role === 'user' ? (
                      <div className="space-y-1.5">
                        <pre className="whitespace-pre-wrap font-sans text-inherit">{msg.content}</pre>
                        {msg.attachedFileNames && msg.attachedFileNames.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 border-t border-zinc-700/80 pt-2 mt-2">
                            {msg.attachedFileNames.map((name) => (
                              <span
                                key={name}
                                className="inline-flex items-center gap-1 rounded bg-zinc-700/60 px-2 py-0.5 text-[11px] text-zinc-400"
                              >
                                <Paperclip className="h-3 w-3 shrink-0" />
                                {name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="markdown-chat [&_p]:my-1.5 [&_ul]:my-2 [&_ol]:my-2 [&_li]:ml-4 [&_strong]:font-semibold [&_strong]:text-zinc-200 [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_pre]:my-2 [&_pre]:rounded-md">
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
                                <code className="bg-zinc-800 text-emerald-300 font-mono text-xs" {...props}>
                                  {children}
                                </code>
                              )
                            },
                            strong: ({ children }) => <strong className="font-semibold text-zinc-200">{children}</strong>,
                            a: ({ href, children }) => (
                              <a href={href} target="_blank" rel="noopener noreferrer" className="text-emerald-400 underline hover:text-emerald-300">
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
                          className="rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-zinc-700 hover:text-zinc-100 disabled:opacity-50"
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-700">
                    <User className="h-3.5 w-3.5 text-zinc-400" />
                  </div>
                )}
              </div>
            )
          })
        })()}
        {streamingContent !== null && (
          <div className="flex gap-3 justify-start">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
              <Bot className="h-3.5 w-3.5 text-emerald-400" />
            </div>
            <div className="max-w-[85%] rounded-lg border border-zinc-700/80 bg-zinc-800/80 px-3 py-2 text-sm text-zinc-300">
              <span className="whitespace-pre-wrap font-sans">{streamingContent || '\u00a0'}</span>
              <span className="inline-block w-0.5 h-4 ml-0.5 bg-emerald-400 animate-cursor-blink align-middle" aria-hidden />
            </div>
          </div>
        )}
        {sending && streamingContent === null && (
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400" />
            </div>
            <span className="text-sm text-zinc-500">
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
              <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
            </div>
            <div className="flex flex-col gap-2 rounded-lg border border-amber-500/30 bg-zinc-800/90 px-3 py-2">
              <p className="text-sm text-zinc-300">Run this command?</p>
              <pre className="overflow-x-auto rounded bg-zinc-900 px-2 py-1.5 font-mono text-xs text-zinc-400">{pendingCommand.command}</pre>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleCommandConfirm(true, pendingCommand)}
                  className="rounded bg-emerald-500/20 px-3 py-1.5 text-xs font-medium text-emerald-400 transition hover:bg-emerald-500/30"
                >
                  Allow
                </button>
                <button
                  type="button"
                  onClick={() => handleCommandConfirm(false, pendingCommand)}
                  className="rounded bg-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-zinc-600"
                >
                  Deny
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-zinc-800 p-4">
        {attachedFiles.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {attachedFiles.map((f) => (
              <span
                key={f.fileId}
                className="inline-flex items-center gap-1 rounded bg-zinc-800 px-2 py-1 text-[10px] text-zinc-300"
              >
                {f.name}
                <button type="button" onClick={() => removeAttachment(f.fileId)} className="rounded p-0.5 hover:bg-zinc-700">
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
          {/* Custom drag overlay: avoids browser's white "+ Copy" UI */}
          {inputDragOver && (
            <div
              className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl border-2 border-emerald-500/60 bg-zinc-900/95 text-sm font-medium text-emerald-400"
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
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300"
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
            className="h-11 min-w-0 flex-1 resize-none rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-500 outline-none focus:border-emerald-500/50 disabled:opacity-50"
            disabled={sending}
          />
          <button
            type="button"
            onClick={send}
            disabled={!canSend}
            className="flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-emerald-500/20 px-4 text-sm font-medium text-emerald-400 transition hover:bg-emerald-500/30 disabled:opacity-40 disabled:hover:bg-emerald-500/20"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
