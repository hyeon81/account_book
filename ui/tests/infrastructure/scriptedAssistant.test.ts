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

test('chat input parses Korean money units and preserves the time in the memo', async () => {
  for (const [text, amount] of [['5천원', 5000], ['1만5천원', 15000], ['2.5만원', 25000]] as const) {
    const response = await scriptedAssistant.ask(`오늘 오후 3시에 카페에서 ${text} 썼어`, monthOf(seoulToday()), [])
    assert.equal(response.kind, 'transaction_draft')
    if (response.kind === 'transaction_draft') {
      assert.equal(response.draft.amount, amount)
      assert.equal(response.draft.categoryId, 'cafe')
      assert.equal(response.draft.merchant, '카페')
      assert.equal(response.draft.date, seoulToday())
      assert.match(response.draft.memo, /오후 3시/)
    }
  }
})

test('card SMS in chat returns the same editable draft without saving', async () => {
  const date = seoulToday()
  const response = await scriptedAssistant.ask(`[Web발신]\n모아카드 승인\n5,500원 일시불\n${date.replaceAll('-', '/')} 14:30\n달빛커피\n누적 125,500원`, monthOf(date), [])
  assert.equal(response.kind, 'transaction_draft')
  if (response.kind === 'transaction_draft') {
    assert.equal(response.draft.amount, 5500)
    assert.equal(response.draft.merchant, '달빛커피')
    assert.equal(response.draft.categoryId, 'cafe')
  }
})

test('unsafe and ambiguous amounts do not become transaction drafts', async () => {
  for (const text of ['카드 승인취소 5,000원', '카페에서 12,34원 썼어', '커피 5천원 점심 1만원 썼어', '카페에서 -5000원 썼어']) {
    const response = await scriptedAssistant.ask(text, monthOf(seoulToday()), [])
    assert.equal(response.kind, 'clarification')
    if (response.kind === 'clarification') assert.equal(response.continueContext, false)
  }
})

test('a follow-up amount completes an incomplete cafe message', async () => {
  const response = await scriptedAssistant.ask('오늘 카페에서 마셨어 5천원', monthOf(seoulToday()), [])
  assert.equal(response.kind, 'transaction_draft')
  if (response.kind === 'transaction_draft') assert.equal(response.draft.amount, 5000)
})
