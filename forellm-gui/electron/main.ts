import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { spawn, type SpawnOptions } from 'child_process'
import { existsSync } from 'fs'
import path from 'path'
import { is } from '@electron-toolkit/utils'

let mainWindow: BrowserWindow | null = null

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

function registerIpc(): void {
  ipcMain.handle('forellm:system', async () => {
    return execForellm(['system', '--json'])
  })

  ipcMain.handle(
    'forellm:fit',
    async (
      _,
      opts?: { memory?: string; maxContext?: number; limit?: number; sort?: string }
    ) => {
      const args: string[] = []
      if (opts?.memory) args.push('--memory', opts.memory)
      if (opts?.maxContext) args.push('--max-context', String(opts.maxContext))
      args.push('fit', '--json')
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
}

function createWindow(): void {
  const iconPath = path.join(__dirname, '..', '..', 'assets', 'icon.png')
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#09090b',
    icon: iconPath,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
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
}

app.whenReady().then(() => {
  registerIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
