import { app, BrowserWindow, ipcMain, Menu, shell } from 'electron'
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
  const repoRootLogo = path.join(repoRoot, 'forellm-original.png')
  const repoAssetsLogo = path.join(repoRoot, 'assets', 'forellm-original.png')
  const publicIcon = path.join(guiRoot, 'public', 'icon.png')
  const iconPath =
    existsSync(repoRootLogo) ? repoRootLogo
    : existsSync(repoAssetsLogo) ? repoAssetsLogo
    : publicIcon
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
