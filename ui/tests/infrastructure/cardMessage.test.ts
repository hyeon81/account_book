import test from 'node:test'
import assert from 'node:assert/strict'
import { parseCardMessage } from '../../src/infrastructure/cardMessage.ts'

test('parses multiline domestic KRW approval with auxiliary accumulated spend ignored', () => {
  const result = parseCardMessage(`[KB국민카드]
10/13 12:34
스타벅스강남
12,000원 승인
누적 450,000원`, '2026-10-13')

  assert.equal(result.kind, 'draft')
  if (result.kind !== 'draft') return
  assert.deepEqual(result.draft, {
    date: '2026-10-13',
    type: 'expense',
    amount: 12000,
    categoryId: 'cafe',
    merchant: '스타벅스강남',
    memo: '카드 문자 붙여넣기 초안',
  })
  assert.match(result.categoryReason, /카페/)
})

test('parses merchant on same line after timestamp and amount', () => {
  const result = parseCardMessage('신한카드 2026-10-12 18:20 8,500원 승인 김밥천국역삼점 잔액 20,000원', '2026-10-13')

  assert.equal(result.kind, 'draft')
  if (result.kind !== 'draft') return
  assert.equal(result.draft.date, '2026-10-12')
  assert.equal(result.draft.amount, 8500)
  assert.equal(result.draft.merchant, '김밥천국역삼점')
  assert.equal(result.draft.categoryId, 'food')
})

test('parses pasted UI example with yyyy slash date and merchant on following line', () => {
  const result = parseCardMessage(`[Web발신]
모아카드 승인
5,500원 일시불
2026/10/13 14:30
달빛커피
누적 125,500원`, '2026-10-13')

  assert.equal(result.kind, 'draft')
  if (result.kind !== 'draft') return
  assert.equal(result.draft.date, '2026-10-13')
  assert.equal(result.draft.amount, 5500)
  assert.equal(result.draft.merchant, '달빛커피')
  assert.equal(result.draft.categoryId, 'cafe')
})

test('removes full timestamp from same-line merchant text', () => {
  const result = parseCardMessage('모아카드 승인 5,500원 일시불 2026/10/13 14:30 달빛커피', '2026-10-13')

  assert.equal(result.kind, 'draft')
  if (result.kind !== 'draft') return
  assert.equal(result.draft.merchant, '달빛커피')
  assert.equal(result.draft.categoryId, 'cafe')
})

test('allows card-company words when they are real merchant brands', () => {
  const taxi = parseCardMessage('카드 승인 10/13 11:30 13,200원 카카오T택시', '2026-10-13')
  const burger = parseCardMessage('카드 승인 10/13 12:30 8,900원 롯데리아강남', '2026-10-13')
  const department = parseCardMessage('카드 승인 10/13 15:30 77,000원 현대백화점무역센터', '2026-10-13')

  assert.equal(taxi.kind, 'draft')
  assert.equal(burger.kind, 'draft')
  assert.equal(department.kind, 'draft')
  if (taxi.kind !== 'draft' || burger.kind !== 'draft' || department.kind !== 'draft') return
  assert.equal(taxi.draft.categoryId, 'transport')
  assert.equal(burger.draft.categoryId, 'food')
  assert.equal(department.draft.merchant, '현대백화점무역센터')
})

test('uses purchase amount after a cumulative amount on the same line', () => {
  const result = parseCardMessage('국민카드 누적 20,000원 결제 5,500원 10/13 14:30 달빛커피', '2026-10-13')

  assert.equal(result.kind, 'draft')
  if (result.kind !== 'draft') return
  assert.equal(result.draft.amount, 5500)
  assert.equal(result.draft.merchant, '달빛커피')
})

test('keeps category empty when merchant rule is unknown', () => {
  const result = parseCardMessage('현대카드 10/13 09:10 33,000원 승인 로컬상점', '2026-10-13')

  assert.equal(result.kind, 'draft')
  if (result.kind !== 'draft') return
  assert.equal(result.draft.categoryId, '')
  assert.match(result.categoryReason, /사용자/)
})

test('infers previous year for December card SMS pasted in January', () => {
  const result = parseCardMessage('삼성카드 12/31 23:50 4,500원 승인 GS25역삼', '2026-01-02')

  assert.equal(result.kind, 'draft')
  if (result.kind !== 'draft') return
  assert.equal(result.draft.date, '2025-12-31')
  assert.equal(result.draft.categoryId, 'living')
})

test('rejects cancellation declined foreign and multiple purchase amounts', () => {
  assert.equal(parseCardMessage('롯데카드 10/13 12:00 10,000원 승인취소 스타벅스', '2026-10-13').kind, 'unsupported')
  assert.equal(parseCardMessage('현대카드 10/13 12:00 USD 10 해외 승인 AMAZON', '2026-10-13').kind, 'unsupported')
  assert.equal(parseCardMessage('BC카드 10/13 12:00 10,000원 승인 카페\n10/13 13:00 20,000원 승인 식당', '2026-10-13').kind, 'unsupported')
})

test('rejects malformed or incomplete transaction messages instead of inventing data', () => {
  assert.equal(parseCardMessage('신한카드 02/30 12:00 9,000원 승인 카페', '2026-10-13').kind, 'unsupported')
  assert.equal(parseCardMessage('국민카드 10/13 12:00 승인 스타벅스', '2026-10-13').kind, 'unsupported')
  assert.equal(parseCardMessage('국민카드 10/13 12:00 12,000원 승인', '2026-10-13').kind, 'unsupported')
  assert.equal(parseCardMessage('국민카드 10/13 12:00 12,34원 승인 스타벅스', '2026-10-13').kind, 'unsupported')
})
