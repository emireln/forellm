import type { Config } from 'tailwindcss'

export default {
  content: ['./src/**/*.{ts,tsx}', './index.html'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', 'ui-monospace', 'monospace'],
        sans: ['"Inter"', 'ui-sans-serif', 'system-ui', 'sans-serif']
      },
      colors: {
        neon: {
          green: '#22c55e',
          cyan: '#06b6d4',
          amber: '#f59e0b',
          red: '#ef4444'
        }
      },
      boxShadow: {
        'neon-green': '0 0 12px rgba(34,197,94,0.25)',
        'neon-cyan': '0 0 12px rgba(6,182,212,0.25)',
        'neon-amber': '0 0 12px rgba(245,158,11,0.25)',
        'neon-red': '0 0 12px rgba(239,68,68,0.25)'
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite'
      }
    }
  },
  plugins: []
} satisfies Config
