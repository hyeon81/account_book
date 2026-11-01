import test from 'node:test'
import assert from 'node:assert/strict'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { chatProxy } from '../../chatProxy.ts'

test('proxy keeps agent address on the server and only routes the chat path', () => {
  const configured = chatProxy('http://agent:8100')
  assert.deepEqual(Object.keys(configured.proxy), ['/api/chat'])
  assert.equal(configured.proxy['/api/chat'].target, 'http://agent:8100')
  assert.equal(configured.proxy['/api/chat'].rewrite?.('/api/chat'), '/chat')
  assert.deepEqual(chatProxy(undefined).proxy, {})
  for (const url of ['file:///tmp/agent', 'http://user:secret@agent', 'http://agent/private', 'http://agent?key=secret']) {
    assert.throws(() => chatProxy(url))
  }
})

test('runtime configuration exposes only the enabled flag for dev and preview', () => {
  for (const enabled of [false, true]) {
    const { plugin } = chatProxy(enabled ? 'http://agent:8100' : undefined)
    for (const hook of [plugin.configureServer, plugin.configurePreviewServer]) {
      let handler: (request: IncomingMessage, response: ServerResponse, next: () => void) => void = () => assert.fail('handler missing')
      assert.equal(typeof hook, 'function')
      ;(hook as (server: unknown) => void)({ middlewares: { use(value: typeof handler) { handler = value } } })
      const headers = new Map<string, string>()
      let output = '', next = false
      const response = { setHeader(name: string, value: string) { headers.set(name, value) }, end(text: string) { output = text }, statusCode: 200 }
      handler({ url: '/api/chat/config', method: 'GET' } as IncomingMessage, response as unknown as ServerResponse, () => { next = true })
      assert.equal(output, JSON.stringify({ enabled }))
      assert.equal(headers.get('Cache-Control'), 'no-store')
      assert.equal(next, false)
      handler({ url: '/api/transactions', method: 'GET' } as IncomingMessage, response as unknown as ServerResponse, () => { next = true })
      assert.equal(next, true)
      handler({ url: '/api/chat/config', method: 'POST' } as IncomingMessage, response as unknown as ServerResponse, () => undefined)
      assert.equal(response.statusCode, 405)
    }
  }
})
