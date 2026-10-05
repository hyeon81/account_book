import test from 'node:test'
import assert from 'node:assert/strict'
import { mockAssistant } from '../../src/infrastructure/mockAssistant.ts'
import { monthOf, seoulToday } from '../../src/domain/transaction.ts'

test('a registration request returns an unpersisted draft', async () => {
  const response = await mockAssistant.ask('오늘 점심에 12,000원 썼어', monthOf(seoulToday()))
  assert.equal(response.kind, 'transaction_draft')
  if (response.kind === 'transaction_draft') {
    assert.equal(response.draft.amount, 12000)
    assert.equal(response.draft.categoryId, 'food')
  }
})

test('an incomplete request asks for clarification', async () => {
  const response = await mockAssistant.ask('오늘 점심 먹었어', monthOf(seoulToday()))
  assert.equal(response.kind, 'clarification')
})
