import test from 'node:test'
import assert from 'node:assert/strict'
import { transactionDraftRequest } from '../../src/application/transactionDraft.ts'
import { requestTransactionDraft } from '../../src/infrastructure/transactionDraft.ts'
import type { Transaction } from '../../src/domain/transaction.ts'

const datasetId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

const saved: Transaction = {
  id: 'coffee', date: '2026-10-13', type: 'expense', amount: 5500,
  categoryId: 'cafe', merchant: '달빛커피', memo: '라떼',
}
const request = transactionDraftRequest(datasetId, '오늘 오후 3시에 카페에서 5천원 썼어', [saved], '2026-10-14')
const result = {
  status: 'draft', reason: '카페 근거', requires_confirmation: true,
  draft: { date: '2026-10-14', type: 'expense', amount: 5000, categoryId: 'cafe', merchant: '달빛커피', memo: '오후 3시' },
  recommendation: {
    status: 'recommended', category_id: 'cafe', reason: '카페 근거',
    evidence_ids: ['transaction:coffee'], requires_confirmation: true,
    evidence: [{ id: 'transaction:coffee', category_id: 'cafe', source: 'transaction', text: '거래처: 달빛커피\n메모: 라떼' }],
  },
}

test('transaction draft adapter posts to same-origin draft API and validates response', async () => {
  const response = await requestTransactionDraft(request, new AbortController().signal, async (url, init) => {
    assert.equal(url, '/api/transaction-draft')
    assert.equal(init?.method, 'POST')
    assert.deepEqual(JSON.parse(String(init?.body)), request)
    assert.ok(init?.signal instanceof AbortSignal)
    return new Response(JSON.stringify(result), { status: 200 })
  })
  assert.equal(response.draft?.categoryId, 'cafe')
})

test('server setup failure and malformed body keep manual input available', async () => {
  const signal = new AbortController().signal
  await assert.rejects(requestTransactionDraft(request, signal, async () => new Response('', { status: 503 })), /직접 입력/)
  await assert.rejects(requestTransactionDraft(request, signal, async () => new Response('<html>proxy unavailable</html>')), /응답을 읽지/)
  await assert.rejects(requestTransactionDraft(request, signal, async () => new Response(JSON.stringify({ ...result, draft: { ...result.draft, categoryId: 'food' } }))), /초안/)
})

test('timeout aborts transport and reports draft guidance', async () => {
  const send: typeof fetch = async (_url, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
  })
  await assert.rejects(requestTransactionDraft(request, new AbortController().signal, send, 5), /시간이 초과/)
})
