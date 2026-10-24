import test from 'node:test'
import assert from 'node:assert/strict'
import { createTransactionApi } from '../../src/infrastructure/transactionApi.ts'
import { createLocalLedger, ledgerStorageKey } from '../../src/infrastructure/localLedger.ts'

const row = (id = 'transaction-1') => ({ id, date: '2026-10-24', type: 'expense', amount: 5500, currency: 'KRW', category_id: 'cafe', merchant: '카페', memo: '' })
const input = { date: '2026-10-24', type: 'expense' as const, amount: 5500, categoryId: 'cafe', merchant: '카페', memo: '' }
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })

test('load follows all cursors and translates the server contract', async () => {
  const paths: string[] = []
  const api = createTransactionApi(async (url) => {
    paths.push(String(url))
    return paths.length === 1 ? response({ items: [row()], next_cursor: 'next+/=' }) : response({ items: [row('transaction-2')], next_cursor: null })
  })
  const items = await api.load()
  assert.equal(items.length, 2)
  assert.deepEqual(items[0], { id: 'transaction-1', ...input })
  assert.equal(new URL(paths[1], 'http://localhost').searchParams.get('cursor'), 'next+/=')
  assert.equal(new URL(paths[0], 'http://localhost').searchParams.get('limit'), '500')
})

test('load rejects duplicate rows, looping cursors and invalid transaction responses', async () => {
  const duplicate = createTransactionApi(async () => response({ items: [row()], next_cursor: 'same' }))
  await assert.rejects(duplicate.load(), /거래가 변경/)
  const looping = createTransactionApi(async () => response({ items: [], next_cursor: 'same' }))
  await assert.rejects(looping.load(), /끝까지/)
  const invalid = createTransactionApi(async () => response({ items: [{ ...row(), amount: 0 }], next_cursor: null }))
  await assert.rejects(invalid.load(), /응답/)
})

test('DB errors and malformed pages never become an empty successful ledger', async () => {
  const failure = createTransactionApi(async () => response({ error: { code: 'DATABASE_UNAVAILABLE', message: '저장소 장애' } }, 503))
  await assert.rejects(failure.load(), /저장소 장애/)
  const malformed = createTransactionApi(async () => response({ items: [] }))
  await assert.rejects(malformed.load(), /목록 응답/)
})

test('CRUD sends snake_case fields, escapes IDs, and accepts an empty 204', async () => {
  const calls: { path: string; method: string; body: unknown }[] = []
  const api = createTransactionApi(async (url, init) => {
    calls.push({ path: String(url), method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : undefined })
    return init?.method === 'DELETE' ? new Response(null, { status: 204 }) : response(row(), init?.method === 'POST' ? 201 : 200)
  })
  await api.add(input)
  await api.update('opaque/id', input)
  await api.remove('opaque/id')
  assert.equal(calls[0].method, 'POST')
  assert.deepEqual(calls[0].body, { date: input.date, type: input.type, amount: input.amount, currency: 'KRW', category_id: 'cafe', merchant: '카페', memo: '' })
  assert.equal(calls[1].path, '/api/transactions/opaque%2Fid')
  assert.equal(calls[2].body, undefined)
})

test('failed writes propagate to the form without automatic retries', async () => {
  let calls = 0
  const api = createTransactionApi(async () => { calls++; return response({ error: { message: '거래를 찾을 수 없어요.' } }, 404) })
  await assert.rejects(api.update('missing', input), /찾을 수/)
  assert.equal(calls, 1)
})

test('explicit import keeps browser backups and IDs and batches at 100 records', async () => {
  const backup = Array.from({ length: 201 }, (_, index) => ({ id: `local-${index}`, ...input }))
  const original = JSON.stringify(backup)
  const storage = { getItem: (key: string) => key === ledgerStorageKey ? original : null, setItem: () => assert.fail('Import must never rewrite browser backup') }
  const batches: { id: string }[][] = []
  const api = createTransactionApi(async (_url, init) => {
    const batch = JSON.parse(String(init?.body)).items
    batches.push(batch)
    return response({ imported: batch.length, skipped: 0 })
  })
  assert.deepEqual(await api.importItems(createLocalLedger(storage).load()), { imported: 201, skipped: 0 })
  assert.deepEqual(batches.map((batch) => batch.length), [100, 100, 1])
  assert.equal(batches[2][0].id, 'local-200')
  assert.equal(storage.getItem(ledgerStorageKey), original)
})

test('a partially failed import can retry unchanged IDs and count server skips', async () => {
  const backup = Array.from({ length: 101 }, (_, index) => ({ id: `local-${index}`, ...input }))
  const imported = new Set<string>()
  let fail = true
  const api = createTransactionApi(async (_url, init) => {
    const batch = JSON.parse(String(init?.body)).items as { id: string }[]
    if (batch[0].id === 'local-100' && fail) return response({ error: { message: '저장소 장애' } }, 503)
    const count = batch.filter((item) => !imported.has(item.id)).length
    batch.forEach((item) => imported.add(item.id))
    return response({ imported: count, skipped: batch.length - count })
  })
  await assert.rejects(api.importItems(backup), /저장소 장애/)
  fail = false
  assert.deepEqual(await api.importItems(backup), { imported: 1, skipped: 100 })
  assert.equal(imported.size, 101)
})

test('import splits long Unicode text before the HTTP body limit', async () => {
  const backup = Array.from({ length: 100 }, (_, index) => ({ id: `long-${index}`, ...input, memo: '메'.repeat(1000) }))
  const sizes: number[] = []
  const api = createTransactionApi(async (_url, init) => {
    sizes.push(new TextEncoder().encode(String(init?.body)).byteLength)
    return response({ imported: JSON.parse(String(init?.body)).items.length, skipped: 0 })
  })
  assert.deepEqual(await api.importItems(backup), { imported: 100, skipped: 0 })
  assert.ok(sizes.length > 1)
  assert.ok(sizes.every((size) => size <= 190000))
})

test('invalid import receipts are errors instead of claimed success', async () => {
  const api = createTransactionApi(async () => response({ imported: 0, skipped: 0 }))
  await assert.rejects(api.importItems([{ id: 'local-1', ...input }]), /가져오기 결과/)
})

test('timeouts and caller cancellation abort the transport', async () => {
  const api = createTransactionApi(async (_url, init) => new Promise<Response>((_resolve, reject) => {
    const abort = () => reject(new Error('aborted'))
    if (init?.signal?.aborted) abort()
    else init?.signal?.addEventListener('abort', abort, { once: true })
  }), 5)
  await assert.rejects(api.load(), /취소되었거나 시간이 초과/)
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(api.load(controller.signal), /취소되었거나 시간이 초과/)
})
