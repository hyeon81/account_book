import test from 'node:test'
import assert from 'node:assert/strict'
import { filterTransactions, summarize, validateTransaction } from '../../src/application/ledger.ts'
import type { Transaction } from '../../src/domain/transaction.ts'

const records: Transaction[] = [
  { id: '1', date: '2026-10-02', type: 'income', amount: 3000000, categoryId: 'salary', merchant: '회사', memo: '' },
  { id: '2', date: '2026-10-03', type: 'expense', amount: 12000, categoryId: 'food', merchant: '식당', memo: '' },
  { id: '3', date: '2026-09-30', type: 'expense', amount: 2000, categoryId: 'cafe', merchant: '카페', memo: '' },
]

test('summary uses only confirmed transactions in the selected month', () => {
  const result = summarize(records, '2026-10')
  assert.equal(result.incomeTotal, 3000000)
  assert.equal(result.expenseTotal, 12000)
  assert.equal(result.difference, 2988000)
  assert.equal(result.expensesByCategory[0].category.id, 'food')
})

test('filters preserve month, type and category together', () => {
  const result = filterTransactions(records, { month: '2026-10', type: 'expense', categoryId: 'food' })
  assert.deepEqual(result.map((item) => item.id), ['2'])
})

test('validation rejects invalid money and mismatched categories', () => {
  const errors = validateTransaction({ date: '2026-10-03', type: 'expense', amount: 0, categoryId: 'salary', merchant: '', memo: '' })
  assert.ok(errors.amount)
  assert.ok(errors.categoryId)
})

test('validation rejects dates that roll into the next month', () => {
  const errors = validateTransaction({ date: '2026-02-30', type: 'expense', amount: 1000, categoryId: 'food', merchant: '', memo: '' })
  assert.ok(errors.date)
})
