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
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url)
}

contextBridge.exposeInMainWorld('forellm', api)
