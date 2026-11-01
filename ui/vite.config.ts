import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { defineConfig } from 'vite'
import { chatProxy } from './chatProxy.ts'

const chat = chatProxy(process.env.AGENT_BASE_URL)
const proxy = { ...chat.proxy, '/api': { target: process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:8000', changeOrigin: false } }

export default defineConfig({
  plugins: [chat.plugin, react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
  server: {
    proxy,
    watch: process.env.VITE_USE_POLLING === 'true' ? { usePolling: true, interval: 300 } : undefined,
  },
  preview: { proxy },
})
