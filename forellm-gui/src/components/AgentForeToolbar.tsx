import { useState } from 'react'
import { Bot, Download, ChevronDown, MessageSquarePlus, RotateCcw, Trash2, History, Pencil, Check } from 'lucide-react'
import { cn } from '../lib/types'
import { AGENTS } from '../lib/agentConfig'

const POPOVER =
  'rounded-lg border border-zinc-300 bg-white py-1 shadow-lg dark:border-zinc-600 dark:bg-zinc-800'
const OPTION_BASE =
  'w-full px-3 py-2 text-left text-xs transition-colors first:rounded-t-[7px] last:rounded-b-[7px]'
const OPTION_HOVER =
  'hover:bg-zinc-100 dark:hover:bg-zinc-700'
const OPTION_ACTIVE = 'bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
const TRIGGER_BASE =
  'inline-flex items-center justify-between gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-800 shadow-sm transition-colors dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:border-zinc-500'

type OpenDropdown = 'agent' | 'backend' | 'model' | 'export' | 'history' | null

interface ToolbarDropdownProps<T extends string> {
  label: string
  value: T
  options: { value: T; label: string }[]
  onSelect: (value: T) => void
  open: boolean
  onOpenChange: (open: boolean) => void
  id: OpenDropdown
  disabled?: boolean
  triggerClassName?: string
  title?: string
}

function ToolbarDropdown<T extends string>({
  label,
  value,
  options,
  onSelect,
  open,
  onOpenChange,
  id,
  disabled,
  triggerClassName,
  title
}: ToolbarDropdownProps<T>) {
  const display = options.find((o) => o.value === value)?.label ?? value
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">{label}</span>
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          title={title}
          onClick={() => onOpenChange(!open)}
          className={cn(
            TRIGGER_BASE,
            'min-w-[7rem]',
            disabled && 'opacity-50 cursor-not-allowed',
            triggerClassName
          )}
        >
          <span className="min-w-0 truncate">{display}</span>
          <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 transition-transform', open && 'rotate-180')} />
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-10" aria-hidden onClick={() => onOpenChange(false)} />
            <div
              className={cn('absolute left-0 right-0 top-full z-20 mt-1.5', POPOVER)}
              role="listbox"
            >
              {options.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  onClick={() => {
                    onSelect(opt.value as T)
                    onOpenChange(false)
                  }}
                  className={cn(OPTION_BASE, OPTION_HOVER, value === opt.value && OPTION_ACTIVE)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

interface ToolbarModelDropdownProps {
  label: string
  value: string
  options: string[]
  onSelect: (value: string) => void
  open: boolean
  onOpenChange: (open: boolean) => void
  disabled?: boolean
  loadingLabel?: string
}

function ToolbarModelDropdown({
  label,
  value,
  options,
  onSelect,
  open,
  onOpenChange,
  disabled,
  loadingLabel
}: ToolbarModelDropdownProps) {
  const display = options.length ? (value || 'Select…') : (loadingLabel ?? 'Loading…')
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">{label}</span>
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => options.length > 0 && onOpenChange(!open)}
          className={cn(
            TRIGGER_BASE,
            'min-w-[8rem] max-w-[14rem]',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          <span className="min-w-0 truncate">{display}</span>
          <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 transition-transform', open && 'rotate-180')} />
        </button>
        {open && options.length > 0 && (
          <>
            <div className="fixed inset-0 z-10" aria-hidden onClick={() => onOpenChange(false)} />
            <div
              className={cn('absolute left-0 right-0 top-full z-20 mt-1.5 max-h-52 overflow-y-auto', POPOVER)}
              role="listbox"
            >
              {options.map((m, i) => (
                <button
                  key={m}
                  type="button"
                  role="option"
                  onClick={() => {
                    onSelect(m)
                    onOpenChange(false)
                  }}
                  className={cn(OPTION_BASE, OPTION_HOVER, value === m && OPTION_ACTIVE)}
                >
                  {m}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

interface AgentForeToolbarProps {
  agentId: string
  onAgentChange: (id: string) => void
  backend: 'ollama' | 'openclaw'
  onBackendChange: (b: 'ollama' | 'openclaw') => void
  openclawBaseUrl: string
  onOpenClawBaseUrlChange: (url: string) => void
  selectedModel: string
  onModelChange: (model: string) => void
  ollamaModels: string[]
  openclawModels: string[]
  ollamaError: string | null
  openclawError: string | null
  onExport: (format: 'markdown' | 'txt', withToolCalls: boolean) => void
  exportDisabled: boolean
  sessions: { id: string; title: string }[]
  currentSessionId: string | null
  onSessionSelect: (id: string) => void
  onNewChat: () => void
  onResetChat: () => void
  onRemoveChat: () => void
  resetDisabled: boolean
  removeDisabled: boolean
  showRenameInput: boolean
  renameValue: string
  onRenameValueChange: (v: string) => void
  onRenameSubmit: () => void
  onRenameCancel: () => void
  onRenameClick: () => void
  renameDisabled: boolean
}

export function AgentForeToolbar({
  agentId,
  onAgentChange,
  backend,
  onBackendChange,
  openclawBaseUrl,
  onOpenClawBaseUrlChange,
  selectedModel,
  onModelChange,
  ollamaModels,
  openclawModels,
  ollamaError,
  openclawError,
  onExport,
  exportDisabled,
  sessions,
  currentSessionId,
  onSessionSelect,
  onNewChat,
  onResetChat,
  onRemoveChat,
  resetDisabled,
  removeDisabled,
  showRenameInput,
  renameValue,
  onRenameValueChange,
  onRenameSubmit,
  onRenameCancel,
  onRenameClick,
  renameDisabled
}: AgentForeToolbarProps) {
  const [openDropdown, setOpenDropdown] = useState<OpenDropdown>(null)

  const agentOptions = AGENTS.map((a) => ({ value: a.id, label: a.name }))
  const backendOptions = [
    { value: 'ollama' as const, label: 'Ollama' },
    { value: 'openclaw' as const, label: 'OpenClaw' }
  ]
  const modelOptions = backend === 'ollama' ? ollamaModels : openclawModels
  const modelLoading = backend === 'ollama' ? ollamaError : openclawError

  const closeAll = () => setOpenDropdown(null)

  return (
    <header className="flex w-full shrink-0 items-center gap-3 border-b border-zinc-200 bg-white px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-2">
        <Bot className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
          Agent Fore
        </span>
      </div>

      {/* Export menu */}
      <div className="relative">
        <button
          type="button"
          disabled={exportDisabled}
          onClick={() => setOpenDropdown(openDropdown === 'export' ? null : 'export')}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-2.5 py-2 text-xs text-zinc-600 transition-colors dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
            'hover:bg-zinc-50 hover:text-zinc-900 dark:hover:bg-zinc-700 dark:hover:text-zinc-200',
            exportDisabled && 'opacity-50 cursor-not-allowed'
          )}
          title="Export chat"
        >
          <Download className="h-3.5 w-3.5" />
          Export
          <ChevronDown className={cn('h-3 w-3 transition-transform', openDropdown === 'export' && 'rotate-180')} />
        </button>
        {openDropdown === 'export' && (
          <>
            <div className="fixed inset-0 z-10" aria-hidden onClick={closeAll} />
            <div className={cn('absolute left-0 top-full z-20 mt-1.5 min-w-[11rem]', POPOVER)}>
              <button type="button" onClick={() => { onExport('markdown', false); closeAll() }} className={cn(OPTION_BASE, OPTION_HOVER)}>Export as Markdown (clean)</button>
              <button type="button" onClick={() => { onExport('markdown', true); closeAll() }} className={cn(OPTION_BASE, OPTION_HOVER)}>Export as Markdown (with tool calls)</button>
              <button type="button" onClick={() => { onExport('txt', false); closeAll() }} className={cn(OPTION_BASE, OPTION_HOVER)}>Export as TXT (clean)</button>
              <button type="button" onClick={() => { onExport('txt', true); closeAll() }} className={cn(OPTION_BASE, OPTION_HOVER)}>Export as TXT (with tool calls)</button>
            </div>
          </>
        )}
      </div>

      <ToolbarDropdown
        label="Agent"
        value={agentId}
        options={agentOptions}
        onSelect={onAgentChange}
        open={openDropdown === 'agent'}
        onOpenChange={(o) => setOpenDropdown(o ? 'agent' : null)}
        id="agent"
        triggerClassName="min-w-[9rem]"
        title={AGENTS.find((a) => a.id === agentId)?.description}
      />

      <ToolbarDropdown
        label="Backend"
        value={backend}
        options={backendOptions}
        onSelect={(v) => { onBackendChange(v); onModelChange('') }}
        open={openDropdown === 'backend'}
        onOpenChange={(o) => setOpenDropdown(o ? 'backend' : null)}
        id="backend"
        triggerClassName="min-w-[6rem]"
      />

      {backend === 'openclaw' && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">URL</span>
          <input
            type="text"
            value={openclawBaseUrl}
            onChange={(e) => onOpenClawBaseUrlChange(e.target.value)}
            placeholder="127.0.0.1:18789"
            className={cn(TRIGGER_BASE, 'min-w-[8rem] font-mono')}
          />
        </div>
      )}

      <ToolbarModelDropdown
        label="Model"
        value={selectedModel}
        options={modelOptions}
        onSelect={onModelChange}
        open={openDropdown === 'model'}
        onOpenChange={(o) => setOpenDropdown(o ? 'model' : null)}
        disabled={modelOptions.length === 0}
        loadingLabel={modelLoading ?? 'Loading…'}
      />

      <div className="flex-1 min-w-0" aria-hidden />

      <div className="flex items-center gap-0.5">
        <button type="button" onClick={onNewChat} className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-300" title="New chat"><MessageSquarePlus className="h-4 w-4" /></button>
        <button type="button" onClick={onResetChat} disabled={resetDisabled} className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 disabled:opacity-40 dark:hover:bg-zinc-800 dark:hover:text-zinc-300" title="Reset chat"><RotateCcw className="h-4 w-4" /></button>
        <button type="button" onClick={onRemoveChat} disabled={removeDisabled} className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-red-600 disabled:opacity-40 dark:hover:bg-zinc-800 dark:hover:text-red-400" title="Remove chat"><Trash2 className="h-4 w-4" /></button>

        {showRenameInput ? (
          <div className="flex items-center gap-1 rounded-lg border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-800">
            <input
              type="text"
              value={renameValue}
              onChange={(e) => onRenameValueChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') onRenameSubmit(); if (e.key === 'Escape') onRenameCancel() }}
              className="w-32 rounded bg-transparent px-1.5 py-0.5 text-xs text-zinc-800 outline-none dark:text-zinc-200"
              placeholder="Chat name"
              autoFocus
            />
            <button type="button" onClick={onRenameSubmit} className="rounded p-1 text-emerald-600 hover:bg-zinc-100 dark:text-emerald-400 dark:hover:bg-zinc-700" title="Save"><Check className="h-3.5 w-3.5" /></button>
          </div>
        ) : (
          <button type="button" onClick={onRenameClick} disabled={renameDisabled} className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 disabled:opacity-40 dark:hover:bg-zinc-800 dark:hover:text-zinc-300" title="Rename chat"><Pencil className="h-4 w-4" /></button>
        )}

        <div className="relative">
          <button
            type="button"
            onClick={() => setOpenDropdown(openDropdown === 'history' ? null : 'history')}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            title="Previous chats"
          >
            <History className="h-4 w-4" />
          </button>
          {openDropdown === 'history' && (
            <>
              <div className="fixed inset-0 z-10" aria-hidden onClick={closeAll} />
              <div className={cn('absolute right-0 top-full z-20 mt-1.5 max-h-60 min-w-[10rem] max-w-[16rem] overflow-y-auto', POPOVER)}>
                {sessions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => { onSessionSelect(s.id); closeAll() }}
                    className={cn(OPTION_BASE, OPTION_HOVER, currentSessionId === s.id && OPTION_ACTIVE)}
                  >
                    {s.title}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
