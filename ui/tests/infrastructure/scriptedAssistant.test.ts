import test from 'node:test'
import assert from 'node:assert/strict'
import { scriptedAssistant } from '../../src/infrastructure/scriptedAssistant.ts'
import { monthOf, seoulToday } from '../../src/domain/transaction.ts'

test('a registration request returns an unpersisted draft', async () => {
  const response = await scriptedAssistant.ask('오늘 점심에 12,000원 썼어', monthOf(seoulToday()), [])
  assert.equal(response.kind, 'transaction_draft')
  if (response.kind === 'transaction_draft') {
    assert.equal(response.draft.amount, 12000)
    assert.equal(response.draft.categoryId, 'food')
  }
})

test('an incomplete request asks for clarification', async () => {
  const response = await scriptedAssistant.ask('오늘 점심 먹었어', monthOf(seoulToday()), [])
  assert.equal(response.kind, 'clarification')
})

test('a spending answer uses the supplied saved transactions', async () => {
  const date = seoulToday()
  const response = await scriptedAssistant.ask('이번 달 식비 얼마야?', monthOf(date), [
    { id: '1', date, type: 'expense', amount: 12000, categoryId: 'food', merchant: '식당', memo: '' },
  ])
  assert.equal(response.kind, 'answer')
  if (response.kind === 'answer') assert.match(response.reply, /12,000원/)
})
