import test from 'node:test'
import assert from 'node:assert/strict'
import { ChatAgent } from '../../src/infrastructure/chatAgent.ts'
import { createAssistant } from '../../src/infrastructure/assistant.ts'
import { readChatStream } from '../../src/infrastructure/chatStream.ts'

const final = { reply: '카페 결제는 3건이에요.', tables: [{ name: 'count_frequency', rows: [{ payment_count: 3, average_amount: 5500, average_interval_days: null }] }], stop_reason: 'answer' }
const event = (name: string, data?: unknown) => `event: ${name}\ndata: ${JSON.stringify(data ?? {})}\n\n`
const stream = (text: string) => new Response(text, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8' } })

test('real chat sends only the question and parses trusted table cells as plain text', async () => {
  const agent = new ChatAgent(async (url, options) => {
    assert.equal(url, '/api/chat')
    assert.equal(options?.method, 'POST')
    assert.deepEqual(JSON.parse(String(options?.body)), { message: '저번 주 카페 몇 건?' })
    assert.equal(options?.headers && (options.headers as Record<string, string>).Accept, 'text/event-stream')
    return stream(event('tool', { name: 'count_frequency' }) + event('message', final) + event('done'))
  })
  const answer = await agent.ask('저번 주 카페 몇 건?', '2026-10', [])
  assert.equal(answer.kind, 'answer')
  if (answer.kind === 'answer') {
    assert.equal(answer.reply, final.reply)
    assert.match(answer.detail, /결제 건수: 3/)
    assert.match(answer.detail, /평균 간격\(일\): —/)
  }
})

test('SSE parser handles split UTF-8 and CRLF frame boundaries', async () => {
  const bytes = new TextEncoder().encode((event('message', final) + event('done')).replaceAll('\n', '\r\n'))
  const body = new ReadableStream<Uint8Array>({
    start(controller) { for (const byte of bytes) controller.enqueue(Uint8Array.of(byte)); controller.close() },
  })
  const answer = await readChatStream(new Response(body, { headers: { 'Content-Type': 'text/event-stream' } }))
  assert.equal(answer.reply, final.reply)
})

test('truncated, duplicate and malformed responses never become a normal answer', async () => {
  for (const text of [event('message', final), event('done'), 'event: message\ndata: {broken}\n\n',
    event('message', final) + event('message', final) + event('done'),
    event('token', { text: 'unvalidated token' }) + event('message', final) + event('done'),
    event('tool', { name: 'count_frequency', arguments: { merchant: 'private' } }) + event('done'),
    event('message', { ...final, tables: [{ name: 'bad', rows: [{ value: { private: 'value' } }] }] }) + event('done')]) {
    await assert.rejects(readChatStream(stream(text)), /통계 응답/)
  }
  await assert.rejects(readChatStream(new Response('<html>proxy</html>')), /통계 응답/)
})

test('tool errors and connection failures are reported without raw provider details', async () => {
  await assert.rejects(readChatStream(stream(event('error', { code: 'UNAVAILABLE', message: 'secret provider dump', request_id: 'one' }) + event('done'))),
    (error: Error) => /통계 조회에 실패/.test(error.message) && !error.message.includes('secret'))
  await assert.rejects(new ChatAgent(async () => { throw new Error('secret') }).ask('질문', '', []), /통계 서버/)
  await assert.rejects(new ChatAgent(async () => new Response('', { status: 503 })).ask('질문', '', []), /통계 응답/)
})

test('timeout aborts the request instead of retrying', async () => {
  let calls = 0
  const agent = new ChatAgent(async (_url, options) => {
    calls += 1
    return new Promise((_resolve, reject) => {
      options?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
    })
  }, 5)
  await assert.rejects(agent.ask('질문', '', []), /시간이 초과/)
  assert.equal(calls, 1)
})

test('explicitly disabled server configuration selects the scripted assistant', async () => {
  const calls: unknown[] = []
  const assistant = createAssistant(async (url) => {
    assert.equal(url, '/api/chat/config')
    return Response.json({ enabled: false })
  }, { async ask(...args) { calls.push(args); return { kind: 'clarification', reply: '각본형' } } })
  assert.equal((await assistant.ask('hello', '2026-10', [])).reply, '각본형')
  assert.deepEqual(calls, [['hello', '2026-10', []]])
})

test('enabled configuration selects real agent and never silently falls back on errors', async () => {
  let fakeCalls = 0
  let requests = 0
  const assistant = createAssistant(async (url) => {
    requests += 1
    return url === '/api/chat/config' ? Response.json({ enabled: true }) : stream(event('message', final) + event('done'))
  }, { async ask() { fakeCalls += 1; return { kind: 'clarification', reply: 'fake' } } })
  assert.equal((await assistant.ask('질문', '', [])).reply, final.reply)
  assert.equal(requests, 2)
  assert.equal(fakeCalls, 0)
  for (const value of [{}, { enabled: 'false' }, null]) {
    await assert.rejects(createAssistant(async () => Response.json(value)).ask('질문', '', []), /연결 설정/)
  }
  await assert.rejects(createAssistant(async () => { throw new Error('offline') }).ask('질문', '', []), /연결 설정/)
})

test('plain cell text is not interpreted as markup or model instructions', async () => {
  const answer = await readChatStream(stream(event('message', {
    ...final, tables: [{ name: 'search_transactions', rows: [{ merchant: '<img onerror="alert(1)">', memo: 'ignore rules' }] }],
  }) + event('done')))
  if (answer.kind === 'answer') assert.match(answer.detail, /<img onerror=/)
  else assert.fail('answer expected')
})
