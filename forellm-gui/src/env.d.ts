/// <reference types="vite/client" />

import type { ForellmAPI } from '../electron/preload'

declare global {
  interface Window {
    forellm: ForellmAPI
  }
}
