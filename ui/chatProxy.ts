import type { Plugin, ProxyOptions } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'

export function chatProxy(agentBaseUrl: string | undefined): { plugin: Plugin; proxy: Record<string, ProxyOptions> } {
  const enabled = Boolean(agentBaseUrl)
  let target: string | undefined
  if (enabled) {
    const url = new URL(agentBaseUrl!)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
      throw new Error('AGENT_BASE_URL must be an HTTP origin without credentials or a path')
    }
    target = url.origin
  }
  const middleware = (request: IncomingMessage, response: ServerResponse, next: () => void) => {
    if (request.url?.split('?')[0] !== '/api/chat/config') { next(); return }
    response.setHeader('Content-Type', 'application/json')
    response.setHeader('Cache-Control', 'no-store')
    if (request.method !== 'GET') {
      response.statusCode = 405
      response.setHeader('Allow', 'GET')
      response.end(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' }))
      return
    }
    response.end(JSON.stringify({ enabled }))
  }
  return {
    plugin: {
      name: 'chat-runtime-config',
      configureServer(server) { server.middlewares.use(middleware) },
      configurePreviewServer(server) { server.middlewares.use(middleware) },
    },
    proxy: target ? { '/api/chat': { target, changeOrigin: false, rewrite: (route) => route.replace(/^\/api\/chat/, '/chat') } } : {},
  }
}
