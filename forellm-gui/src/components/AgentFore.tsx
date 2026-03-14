import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import type { SystemInfo, ModelFit } from '../lib/types'
import { cn } from '../lib/types'
import { Bot, Send, Loader2, AlertCircle, User } from 'lucide-react'

interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

interface Props {
  system: SystemInfo | null
  models: ModelFit[]
  contextLength: number
  loading: boolean
}

function buildSystemPrompt(system: SystemInfo | null, models: ModelFit[], contextLength: number): string {
  const lines: string[] = [
    'You are Agent Fore, the AI assistant inside the ForeLLM app. You know everything about ForeLLM and the current machine.',
    '',
    '## ForeLLM app',
    '- ForeLLM is a Rust CLI/TUI/GUI tool that matches LLM models against local hardware (RAM, CPU, GPU).',
    '- Commands: forellm system, forellm fit, forellm list, forellm search, forellm download, forellm recommend, forellm info, forellm plan.',
    '- The GUI shows a Model Explorer (sortable table), hardware sidebar (VRAM, RAM, cores, What-If simulator), Multi-Model Cart, and Docs.',
    '- Fit levels: Perfect, Good, Marginal, TooTight. Run modes: GPU, CPU offload, CPU only.',
    '- Models use min_ram_gb (CPU) and min_vram_gb (GPU). Data from data/hf_models.json (GGUF).',
    '',
    '## Your role',
    '- You are an agent restricted to the forellm project folder. You can suggest commands, edits, and steps.',
    '- Before making or applying file changes, ask the user for confirmation.',
    '- Use the system specs and model list below to give accurate advice (which models fit, download commands, quantization).',
    '- Be concise and helpful. You can suggest forellm CLI commands, Ollama commands, or edits to the repo.',
    ''
  ]

  if (system) {
    lines.push('## Current system specs')
    lines.push(`- CPU: ${system.cpu_name}, ${system.cpu_cores} cores`)
    lines.push(`- RAM: ${system.total_ram_gb} GB total, ${system.available_ram_gb} GB available`)
    lines.push(`- GPU: ${system.has_gpu ? `${system.gpu_name}, ${system.gpu_vram_gb} GB VRAM` : 'none'}`)
    lines.push(`- Backend: ${system.backend}${system.unified_memory ? ', unified memory' : ''}`)
    if (system.os) lines.push(`- OS: ${system.os}`)
    lines.push('')
  }

  lines.push(`## Context length (current): ${contextLength}`)
  lines.push('')
  lines.push('## Models in database (sample; user can see full list in Model Explorer)')
  const sample = models.slice(0, 40)
  for (const m of sample) {
    lines.push(`- ${m.name}: ${m.parameter_count}, fit=${m.fit_level}, ${m.memory_required_gb.toFixed(1)} GB, ${m.use_case}`)
  }
  if (models.length > 40) lines.push(`- ... and ${models.length - 40} more.`)
  lines.push('')
  lines.push('Answer the user based on the above. Suggest forellm or ollama commands when relevant.')
  return lines.join('\n')
}

export function AgentFore({ system, models, contextLength, loading }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [ollamaModels, setOllamaModels] = useState<string[]>([])
  const [ollamaError, setOllamaError] = useState<string | null>(null)
  const [selectedModel, setSelectedModel] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  const systemPrompt = buildSystemPrompt(system, models, contextLength)

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
  }, [messages])

  async function send() {
    const text = input.trim()
    if (!text || sending || !window.forellm?.chatOllama) return
    const modelToUse = selectedModel || ollamaModels[0]
    if (!modelToUse) {
      setOllamaError('Select an Ollama model or start Ollama')
      return
    }

    setInput('')
    const userMsg: ChatMessage = { role: 'user', content: text }
    setMessages((prev) => [...prev, userMsg])
    setSending(true)
    setOllamaError(null)

    const fullHistory: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...messages,
      userMsg
    ]

    try {
      const res = await window.forellm.chatOllama(
        modelToUse,
        fullHistory.map((m) => ({ role: m.role, content: m.content }))
      )
      if (res.success && res.content != null) {
        setMessages((prev) => [...prev, { role: 'assistant', content: res.content }])
      } else {
        setOllamaError(res.error || 'Request failed')
        setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${res.error || 'unknown'}` }])
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setOllamaError(msg)
      setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${msg}` }])
    } finally {
      setSending(false)
    }
  }

  const canSend = input.trim().length > 0 && (selectedModel || ollamaModels[0]) && !sending

  return (
    <div className="flex h-full flex-col bg-zinc-950">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center gap-3 border-b border-zinc-800 px-4 py-2">
        <Bot className="h-3.5 w-3.5 text-emerald-400" />
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Agent Fore
        </span>
        <span className="text-[10px] text-zinc-500">
          Knows system, models, and ForeLLM. Restricted to forellm folder.
        </span>
        <div className="ml-auto flex items-center gap-2">
          <label className="text-[10px] text-zinc-500">Model:</label>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-300 outline-none accent-emerald-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50"
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
            <p className="text-sm">Ask about your hardware, models, or ForeLLM.</p>
            <p className="text-[10px]">e.g. “Which models fit my GPU?” or “How do I download Qwen?”</p>
          </div>
        )}
        {messages.filter((m) => m.role !== 'system').map((msg, i) => (
          <div
            key={i}
            className={cn(
              'flex gap-3',
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            {msg.role === 'assistant' && (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
                <Bot className="h-3.5 w-3.5 text-emerald-400" />
              </div>
            )}
            <div
              className={cn(
                'max-w-[85%] rounded-lg px-3 py-2 text-sm',
                msg.role === 'user'
                  ? 'bg-zinc-800 text-zinc-200'
                  : 'bg-zinc-800/80 text-zinc-300 border border-zinc-700/80'
              )}
            >
              {msg.role === 'user' ? (
                <pre className="whitespace-pre-wrap font-sans text-inherit">{msg.content}</pre>
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
                    {msg.content}
                  </ReactMarkdown>
                </div>
              )}
            </div>
            {msg.role === 'user' && (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-700">
                <User className="h-3.5 w-3.5 text-zinc-400" />
              </div>
            )}
          </div>
        ))}
        {sending && (
          <div className="flex gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400" />
            </div>
            <div className="rounded-lg border border-zinc-700/80 bg-zinc-800/80 px-3 py-2 text-sm text-zinc-500">
              Thinking…
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-zinc-800 p-4">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            placeholder="Message Agent Fore…"
            rows={2}
            className="min-w-0 flex-1 resize-none rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-500 outline-none focus:border-emerald-500/50 disabled:opacity-50"
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
