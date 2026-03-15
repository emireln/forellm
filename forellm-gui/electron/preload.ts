import { contextBridge, ipcRenderer } from 'electron'

export interface ForellmAPI {
  minimize: () => Promise<void>
  maximize: () => Promise<void>
  close: () => Promise<void>
  isMaximized: () => Promise<boolean>
  onWindowMaximizedChange: (callback: (maximized: boolean) => void) => void
  getSystem: () => Promise<unknown>
  getFit: (opts?: {
    memory?: string
    ram?: string
    cores?: number
    maxContext?: number
    limit?: number
    sort?: string
    /** Include all models including TooTight (default true for full Model Explorer list) */
    fitAll?: boolean
  }) => Promise<unknown>
  getRecommend: (opts?: {
    limit?: number
    useCase?: string
    minFit?: string
  }) => Promise<unknown>
  getInfo: (model: string) => Promise<unknown>
  downloadModel: (
    model: string,
    opts?: { quant?: string; list?: boolean }
  ) => Promise<{ success: boolean; stdout: string; stderr: string }>
  getPlan: (
    model: string,
    opts?: { context?: number; quant?: string; targetTps?: number }
  ) => Promise<unknown>
  openExternal: (url: string) => Promise<void>
  chatOllama: (
    model: string,
    messages: Array<{ role: string; content: string }>,
    tools?: Array<{ type: string; function: { name: string; description: string; parameters?: object } }>
  ) => Promise<{
    success: boolean
    content?: string
    contents?: string[]
    error?: string
    pendingCommand?: { command: string }
    continueState?: { model: string; messages: unknown[]; pendingToolCall: { id: string; name: string; arguments: string }; tools?: unknown }
  }>
  chatOllamaContinue: (
    continueState: { model: string; messages: unknown[]; pendingToolCall: { id: string; name: string; arguments: string }; tools?: unknown },
    toolResult: string
  ) => Promise<{
    success: boolean
    content?: string
    contents?: string[]
    error?: string
    pendingCommand?: { command: string }
    continueState?: unknown
  }>
  /** Subscribe to streaming deltas (call before chatOllamaStream). */
  onAgentStreamDelta: (callback: (data: { delta: string; done: boolean; startNewMessage: boolean }) => void) => void
  /** Stream chat; deltas are sent via onAgentStreamDelta. */
  chatOllamaStream: (
    model: string,
    messages: Array<{ role: string; content: string }>,
    tools?: Array<{ type: string; function: { name: string; description: string; parameters?: object } }>
  ) => Promise<{
    success: boolean
    content?: string
    contents?: string[]
    error?: string
    pendingCommand?: { command: string }
    continueState?: unknown
  }>
  listOllamaModels: () => Promise<{ success: boolean; models?: string[]; error?: string }>
  /** OpenClaw backend (OpenAI-compatible). baseUrl optional (default from env OPENCLAW_BASE_URL or 127.0.0.1:18789). */
  listOpenClawModels: (baseUrl?: string) => Promise<{ success: boolean; models?: string[]; error?: string }>
  chatOpenClaw: (
    baseUrl: string | undefined,
    model: string,
    messages: Array<{ role: string; content: string }>,
    tools?: Array<{ type: string; function: { name: string; description: string; parameters?: object } }>
  ) => Promise<{
    success: boolean
    content?: string
    contents?: string[]
    error?: string
    pendingCommand?: { command: string }
    continueState?: unknown
  }>
  chatOpenClawContinue: (continueState: unknown, toolResult: string) => Promise<{
    success: boolean
    content?: string
    contents?: string[]
    error?: string
    pendingCommand?: { command: string }
    continueState?: unknown
  }>
  chatOpenClawStream: (
    baseUrl: string | undefined,
    model: string,
    messages: Array<{ role: string; content: string }>,
    tools?: Array<{ type: string; function: { name: string; description: string; parameters?: object } }>
  ) => Promise<{
    success: boolean
    content?: string
    contents?: string[]
    error?: string
    pendingCommand?: { command: string }
    continueState?: unknown
  }>
  agentUploadFile: (payload: { buffer: ArrayBuffer; name: string; mime?: string }) => Promise<{ success: boolean; fileId?: string; error?: string }>
  agentReadDocument: (fileId: string) => Promise<{ success: boolean; content?: string; error?: string }>
  agentWebSearch: (query: string) => Promise<{ success: boolean; content?: string; error?: string }>
  agentExecutePython: (code: string) => Promise<{ success: boolean; stdout?: string; stderr?: string; error?: string }>
  agentRunCommand: (command: string) => Promise<{ success: boolean; stdout?: string; stderr?: string; error?: string }>
  /** Launcher: capabilities (e.g. runAgent only when not packaged). */
  getLauncherCapabilities: () => Promise<{ runAgentAvailable: boolean; runCliHint?: string }>
  /** Launcher: open a new terminal running Agent Fore CLI (npm run agent). Returns { ok, error } when packaged. */
  launchAgent: () => Promise<{ ok: boolean; error?: string }>
  /** Launcher: get command to run ForeLLM CLI (no spawn). Returns { ok, command? } to copy and run in terminal. */
  launchCli: () => Promise<{ ok: boolean; error?: string; command?: string }>
}

const api: ForellmAPI = {
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  onWindowMaximizedChange: (callback: (maximized: boolean) => void) => {
    ipcRenderer.on('window:maximized', () => callback(true))
    ipcRenderer.on('window:unmaximized', () => callback(false))
  },
  getSystem: () => ipcRenderer.invoke('forellm:system'),
  getFit: (opts) => ipcRenderer.invoke('forellm:fit', opts),
  getRecommend: (opts) => ipcRenderer.invoke('forellm:recommend', opts),
  getInfo: (model) => ipcRenderer.invoke('forellm:info', model),
  downloadModel: (model, opts) => ipcRenderer.invoke('forellm:download', model, opts),
  getPlan: (model, opts) => ipcRenderer.invoke('forellm:plan', model, opts),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  chatOllama: (model, messages, tools) => ipcRenderer.invoke('ollama:chat', model, messages, tools),
  chatOllamaContinue: (continueState, toolResult) => ipcRenderer.invoke('ollama:chatContinue', continueState, toolResult),
  onAgentStreamDelta: (callback: (data: { delta: string; done: boolean; startNewMessage: boolean }) => void) => {
    ipcRenderer.removeAllListeners('agent:streamDelta')
    ipcRenderer.on('agent:streamDelta', (_e, data: { delta: string; done: boolean; startNewMessage: boolean }) => callback(data))
  },
  chatOllamaStream: (model, messages, tools) => ipcRenderer.invoke('ollama:chatStream', model, messages, tools),
  listOllamaModels: () => ipcRenderer.invoke('ollama:listModels'),
  listOpenClawModels: (baseUrl?: string) => ipcRenderer.invoke('openclaw:listModels', baseUrl),
  chatOpenClaw: (baseUrl, model, messages, tools) => ipcRenderer.invoke('openclaw:chat', baseUrl, model, messages, tools),
  chatOpenClawContinue: (continueState, toolResult) => ipcRenderer.invoke('openclaw:chatContinue', continueState, toolResult),
  chatOpenClawStream: (baseUrl, model, messages, tools) => ipcRenderer.invoke('openclaw:chatStream', baseUrl, model, messages, tools),
  agentUploadFile: (payload) => ipcRenderer.invoke('agent:uploadFile', payload),
  agentReadDocument: (fileId) => ipcRenderer.invoke('agent:readDocument', fileId),
  agentWebSearch: (query) => ipcRenderer.invoke('agent:webSearch', query),
  agentExecutePython: (code) => ipcRenderer.invoke('agent:executePython', code),
  agentRunCommand: (command) => ipcRenderer.invoke('agent:runCommand', command),
  getLauncherCapabilities: () => ipcRenderer.invoke('launcher:getCapabilities'),
  launchAgent: () => ipcRenderer.invoke('launcher:runAgent'),
  launchCli: () => ipcRenderer.invoke('launcher:runCli')
}

contextBridge.exposeInMainWorld('forellm', api)
