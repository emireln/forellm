import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  main: {
    build: {
      lib: {
        entry: path.resolve(__dirname, 'electron/main.ts')
      }
    },
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    build: {
      lib: {
        entry: path.resolve(__dirname, 'electron/preload.ts')
      }
    },
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    root: '.',
    build: {
      rollupOptions: {
        input: path.resolve(__dirname, 'index.html')
      }
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src')
      }
    },
    plugins: [react()]
  }
})
