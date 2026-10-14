import test from 'node:test'
import assert from 'node:assert/strict'
import { createTransactionDraftGate, transactionDraftRequest, validateTransactionDraft } from '../../src/application/transactionDraft.ts'
import type { RecommendationResult } from '../../src/application/categoryRecommendation.ts'
import type { Transaction } from '../../src/domain/transaction.ts'

const saved: Transaction = {
  id: 'coffee', date: '2026-10-13', type: 'expense', amount: 5500,
  categoryId: 'cafe', merchant: '달빛커피', memo: '라떼',
}
const recommendation: RecommendationResult = {
  status: 'recommended', category_id: 'cafe', reason: '카페 근거',
  evidence_ids: ['transaction:coffee'], requires_confirmation: true,
  evidence: [{ id: 'transaction:coffee', category_id: 'cafe', source: 'transaction', text: '거래처: 달빛커피\n메모: 라떼' }],
}

test('draft request sends the message, reference date and minimal confirmed history', () => {
  const request = transactionDraftRequest(' 오늘 오후 3시에 카페에서 5천원 썼어 ', [saved, { ...saved, id: 'bad', categoryId: 'deleted' }], '2026-10-14')
  assert.equal(request.message, '오늘 오후 3시에 카페에서 5천원 썼어')
  assert.equal(request.reference_date, '2026-10-14')
  assert.equal(request.timezone, 'Asia/Seoul')
  assert.deepEqual(request.history, [{ id: 'coffee', type: 'expense', category_id: 'cafe', merchant: '달빛커피', memo: '라떼' }])
  assert.equal('amount' in request.history[0], false)
})

test('validated draft requires RAG recommendation to match the filled category', () => {
  const request = transactionDraftRequest('카페 5천원', [saved], '2026-10-14')
  const result = validateTransactionDraft({
    status: 'draft', reason: '분류 완료', requires_confirmation: true,
    draft: { date: '2026-10-14', type: 'expense', amount: 5000, categoryId: 'cafe', merchant: '달빛커피', memo: '오후 3시' },
    recommendation,
  }, request)
  assert.equal(result.draft?.categoryId, 'cafe')
  assert.equal(result.recommendation?.category_id, 'cafe')
  assert.throws(() => validateTransactionDraft({ ...result, draft: { ...result.draft, categoryId: 'food' } }, request), /초안/)
})

test('latest confirmed history must still support cited transaction evidence', () => {
  const original = transactionDraftRequest('카페 5천원', [saved], '2026-10-14')
  const latest = transactionDraftRequest('카페 5천원', [{ ...saved, memo: '수정된 메모' }], '2026-10-14')
  assert.throws(() => validateTransactionDraft({
    status: 'draft', reason: '분류 완료', requires_confirmation: true,
    draft: { date: '2026-10-14', type: 'expense', amount: 5000, categoryId: 'cafe', merchant: '달빛커피', memo: '오후 3시' },
    recommendation,
  }, original, latest), /근거/)
})

test('clarification and unavailable responses carry no draft or recommendation', () => {
  const request = transactionDraftRequest('카페', [], '2026-10-14')
  for (const status of ['needs_clarification', 'unavailable'] as const) {
    const result = validateTransactionDraft({ status, reason: '금액을 알려 주세요.', draft: null, recommendation: null, requires_confirmation: true }, request)
    assert.equal(result.draft, null)
  }
  assert.throws(() => validateTransactionDraft({ status: 'needs_clarification', reason: 'x', draft: { amount: 1 }, recommendation: null, requires_confirmation: true }, request))
})

test('manual changes and newer fill requests abort stale draft responses', () => {
  const gate = createTransactionDraftGate()
  const pending = gate.start()
  gate.invalidate()
  assert.equal(pending.signal.aborted, true)
  assert.equal(pending.isCurrent(), false)
  const older = gate.start()
  const latest = gate.start()
  assert.equal(older.signal.aborted, true)
  assert.equal(latest.isCurrent(), true)
})
