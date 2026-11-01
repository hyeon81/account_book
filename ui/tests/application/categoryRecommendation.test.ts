import test from 'node:test'
import assert from 'node:assert/strict'
import { createRecommendationGate, recommendationRequest, validateRecommendation } from '../../src/application/categoryRecommendation.ts'
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

test('request contains only minimal confirmed same-type history and newest 100', () => {
  const history = Array.from({ length: 110 }, (_, index) => transaction(`item-${index}`, { date: index < 10 ? '2026-09-01' : '2026-10-13' }))
  history.push(transaction('income', { type: 'income', categoryId: 'salary' }))
  history.push(transaction('invalid', { categoryId: 'deleted-category' }))
  const payload = recommendationRequest(datasetId, input, history)
  assert.equal(payload.history.length, 100)
  assert.equal(payload.merchant, '달빛커피')
  assert.equal(payload.memo, '라떼')
  assert.ok(payload.history.every((item) => item.type === 'expense' && item.category_id === 'cafe'))
  assert.equal(payload.history[0].id, 'item-10')
  assert.deepEqual(Object.keys(payload.history[0]), ['id', 'type', 'category_id', 'merchant', 'memo'])
  assert.equal('amount' in payload, false)
  assert.equal('date' in payload, false)
})

test('editing excludes its original record instead of retrieving the record being corrected', () => {
  const editing = transaction('editing')
  assert.deepEqual(recommendationRequest(datasetId, input, [editing, transaction('other')], editing).history.map((item) => item.id), ['other'])
  const { id: _id, ...withoutId } = editing
  assert.equal(recommendationRequest(datasetId, input, [editing], withoutId).history.length, 0)
})

test('deleted history never appears in the next request', () => {
  assert.equal(recommendationRequest(datasetId, input, []).history.length, 0)
  assert.throws(() => validateRecommendation(result, recommendationRequest(datasetId, input, [])))
})

test('recommendation accepts known same-type category with verified retrieved evidence', () => {
  assert.equal(validateRecommendation(result, request).category_id, 'cafe')
  const definition = { ...result, evidence_ids: ['category:cafe'], evidence: [{ id: 'category:cafe', category_id: 'cafe', source: 'category' as const, text: '커피와 음료' }] }
  assert.equal(validateRecommendation(definition, request).status, 'recommended')
})

test('rejects another transaction, wrong category, wrong type and unsupported citations', () => {
  const invalid = [
    { ...result, category_id: 'salary' },
    { ...result, category_id: 'deleted' },
    { ...result, evidence_ids: [] },
    { ...result, evidence_ids: ['transaction:someone-else'] },
    { ...result, category_id: 'food' },
    { ...result, evidence: [{ ...result.evidence[0], category_id: 'food' }] },
    { ...result, evidence: [{ ...result.evidence[0], id: 'transaction:someone-else' }] },
    { ...result, requires_confirmation: false },
    { ...result, reason: 'x'.repeat(501) },
    { ...result, evidence_ids: ['transaction:coffee', 'transaction:coffee'] },
    { ...result, evidence: [...result.evidence, ...result.evidence] },
    { ...result, evidence: [...result.evidence, { id: 'category:cafe', category_id: 'cafe', source: 'category', text: 'uncited' }] },
    { ...result, evidence_ids: ['transaction:coffee', 'category:food'], evidence: [...result.evidence, { id: 'category:food', category_id: 'food', source: 'category', text: 'different category' }] },
  ]
  for (const value of invalid) assert.throws(() => validateRecommendation(value, request))
})

test('uncertain and unavailable results preserve manual choice by carrying no category', () => {
  for (const status of ['needs_clarification', 'unavailable'] as const) {
    assert.equal(validateRecommendation({ ...result, status, category_id: null }, request).category_id, null)
    assert.throws(() => validateRecommendation({ ...result, status }, request))
  }
})

test('manual changes and newer requests abort and invalidate stale recommendation', () => {
  const gate = createRecommendationGate()
  const pending = gate.start()
  gate.invalidate()
  assert.equal(pending.signal.aborted, true)
  assert.equal(pending.isCurrent(), false)
  const previous = gate.start()
  const latest = gate.start()
  assert.equal(previous.signal.aborted, true)
  assert.equal(previous.isCurrent(), false)
  assert.equal(latest.isCurrent(), true)
  gate.invalidate()
  assert.equal(latest.isCurrent(), false)
})

test('oversized query fields are rejected before transmitting any history', () => {
  assert.throws(() => recommendationRequest(datasetId, { ...input, merchant: 'a'.repeat(501) }, []), /500자/)
  assert.throws(() => recommendationRequest(datasetId, { ...input, memo: 'a'.repeat(1001) }, []), /1,000자/)
  assert.equal(recommendationRequest(datasetId, { ...input, merchant: 'a'.repeat(500), memo: 'b'.repeat(1000) }, []).merchant.length, 500)
})

test('in-flight same-ID corrections to merchant or memo invalidate retrieved evidence', () => {
  const original = recommendationRequest(datasetId, input, [transaction('coffee')])
  for (const correction of [{ merchant: '새 사용처' }, { memo: '바뀐 메모' }]) {
    const current = recommendationRequest(datasetId, input, [transaction('coffee', correction)])
    assert.throws(() => validateRecommendation(result, current, original), /근거/)
  }
  assert.equal(validateRecommendation(result, original, original).category_id, 'cafe')
})

test('serialized UTF-8 request drops oldest history below 190KB for Korean text', () => {
  const history = Array.from({ length: 100 }, (_, index) => transaction(`item-${index}`, {
    date: index < 50 ? '2026-10-13' : '2026-10-12', merchant: '가'.repeat(500), memo: '나'.repeat(1000),
  }))
  const payload = recommendationRequest(datasetId, input, history)
  assert.ok(payload.history.length > 0 && payload.history.length < 100)
  assert.ok(new TextEncoder().encode(JSON.stringify(payload)).byteLength < 190000)
  assert.equal(payload.history[0].id, 'item-0')
  assert.equal(payload.history.at(-1)?.id, `item-${payload.history.length - 1}`)
  assert.equal(payload.merchant, '달빛커피')
  assert.equal(payload.memo, '라떼')
})

test('dataset ID is mandatory and responses from a different dataset are rejected', () => {
  assert.equal(request.dataset_id, datasetId)
  assert.throws(() => recommendationRequest('', input, []), /자료 구분값/)
  assert.throws(() => recommendationRequest('not-a-uuid', input, []), /자료 구분값/)
  assert.throws(() => recommendationRequest('aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa', input, []), /자료 구분값/)
  assert.throws(() => validateRecommendation(result, { ...request, dataset_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }, request), /근거/)
})
