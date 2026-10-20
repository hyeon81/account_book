import test from 'node:test'
import assert from 'node:assert/strict'
import { recommendationRequest } from '../../src/application/categoryRecommendation.ts'
import { requestCategoryRecommendation } from '../../src/infrastructure/categoryRecommendation.ts'
import type { RecommendationResult } from '../../src/application/categoryRecommendation.ts'
import type { Transaction, TransactionInput } from '../../src/domain/transaction.ts'

const datasetId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

const input: TransactionInput = { date: '2026-10-13', type: 'expense', amount: 5000, categoryId: '', merchant: ' 달빛커피 ', memo: ' 라떼 ' }
const transaction = (id: string, overrides: Partial<Transaction> = {}): Transaction => ({ ...input, id, categoryId: 'cafe', ...overrides })
const request = recommendationRequest(datasetId, input, [transaction('coffee')])
const result: RecommendationResult = {
  status: 'recommended', category_id: 'cafe', reason: '저장된 같은 사용처의 카페 분류를 참고했어요.',
  evidence_ids: ['transaction:coffee'], requires_confirmation: true,
  evidence: [{ id: 'transaction:coffee', category_id: 'cafe', source: 'transaction', text: '달빛커피 · 라떼' }],
}

test('API adapter uses same-origin POST, abort signal and validated response', async () => {
  const controller = new AbortController()
  const send: typeof fetch = async (url, init) => {
    assert.equal(url, '/api/category-recommendation')
    assert.equal(init?.method, 'POST')
    assert.ok(init?.signal instanceof AbortSignal)
    assert.equal(init.signal.aborted, false)
    assert.deepEqual(JSON.parse(String(init?.body)), request)
    return new Response(JSON.stringify(result), { status: 200 })
  }
  assert.equal((await requestCategoryRecommendation(request, controller.signal, send)).category_id, 'cafe')
})

test('offline and server setup failure give a useful manual-input message', async () => {
  const signal = new AbortController().signal
  await assert.rejects(requestCategoryRecommendation(request, signal, async () => { throw new Error('offline') }), /카테고리를 직접/)
  await assert.rejects(requestCategoryRecommendation(request, signal, async () => new Response('', { status: 503 })), /서비스 설정/)
  await assert.rejects(requestCategoryRecommendation(request, signal, async () => new Response('<html>proxy unavailable</html>')), /응답을 읽지/)
  await assert.rejects(requestCategoryRecommendation(request, signal, async () => new Response(JSON.stringify({ ...result, category_id: 'salary' }))), /근거/)
})


test('API timeout cancels transport and gives manual classification guidance', async () => {
  const send: typeof fetch = async (_url, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
  })
  await assert.rejects(requestCategoryRecommendation(request, new AbortController().signal, send, 5), /시간이 초과/)
})

test('cancellation propagates to transport without turning it into an offline warning', async () => {
  const controller = new AbortController()
  const send: typeof fetch = async (_url, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new Error('cancelled')), { once: true })
    controller.abort()
  })
  await assert.rejects(requestCategoryRecommendation(request, controller.signal, send), /cancelled/)
})
