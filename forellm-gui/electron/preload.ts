import { contextBridge, ipcRenderer } from 'electron'

export interface ForellmAPI {
  getSystem: () => Promise<unknown>
  getFit: (opts?: {
    memory?: string
    maxContext?: number
    limit?: number
    sort?: string
  }) => Promise<unknown>
  getRecommend: (opts?: {
    limit?: number
    useCase?: string
    minFit?: string
  }) => Promise<unknown>
  getInfo: (model: string) => Promise<unknown>
  getPlan: (
    model: string,
    opts?: { context?: number; quant?: string; targetTps?: number }
  ) => Promise<unknown>
  openExternal: (url: string) => Promise<void>
}

const api: ForellmAPI = {
  getSystem: () => ipcRenderer.invoke('forellm:system'),
  getFit: (opts) => ipcRenderer.invoke('forellm:fit', opts),
  getRecommend: (opts) => ipcRenderer.invoke('forellm:recommend', opts),
  getInfo: (model) => ipcRenderer.invoke('forellm:info', model),
  getPlan: (model, opts) => ipcRenderer.invoke('forellm:plan', model, opts),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url)
}

contextBridge.exposeInMainWorld('forellm', api)
