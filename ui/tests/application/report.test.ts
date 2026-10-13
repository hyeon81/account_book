import test from 'node:test'
import assert from 'node:assert/strict'
import { buildReport, sampleReportTransactions } from '../../src/application/report.ts'
import type { Transaction } from '../../src/domain/transaction.ts'
import { validateTransaction } from '../../src/application/ledger.ts'

const records: Transaction[] = [
  { id: 'income', date: '2026-01-05', type: 'income', amount: 1000000, categoryId: 'salary', merchant: '회사', memo: '' },
  { id: 'food', date: '2026-01-07', type: 'expense', amount: 120000, categoryId: 'food', merchant: '식당', memo: '' },
  { id: 'cafe', date: '2026-01-29', type: 'expense', amount: 30000, categoryId: 'cafe', merchant: '카페', memo: '' },
  { id: 'prev', date: '2025-12-10', type: 'expense', amount: 100000, categoryId: 'shopping', merchant: '상점', memo: '' },
  { id: 'other', date: '2026-02-01', type: 'expense', amount: 999999, categoryId: 'living', merchant: '관리비', memo: '' },
]

test('builds current, previous and change metrics for the selected month', () => {
  const report = buildReport(records, '2026-01')

  assert.equal(report.summary.expenseTotal, 150000)
  assert.equal(report.previousSummary.expenseTotal, 100000)
  assert.equal(report.expenseChangePercent, 50)
  assert.equal(report.savingsRate, 85)
})

test('uses the previous month across a year boundary', () => {
  const report = buildReport(records, '2026-01')

  assert.equal(report.previousSummary.expensesByCategory[0].category.id, 'shopping')
})

test('returns null percentages when denominators are zero', () => {
  const report = buildReport([{ id: '1', date: '2026-03-01', type: 'expense', amount: 1000, categoryId: 'food', merchant: '식당', memo: '' }], '2026-03')

  assert.equal(report.expenseChangePercent, null)
  assert.equal(report.savingsRate, null)
})

test('buckets expenses by actual calendar weeks including leap February', () => {
  const report = buildReport([
    { id: '1', date: '2028-02-28', type: 'expense', amount: 1000, categoryId: 'food', merchant: '식당', memo: '' },
    { id: '2', date: '2028-02-29', type: 'expense', amount: 2000, categoryId: 'cafe', merchant: '카페', memo: '' },
  ], '2028-02')

  assert.deepEqual(report.weeklyExpenses.map((bucket) => [bucket.label, bucket.amount]), [
    ['1-7일', 0],
    ['8-14일', 0],
    ['15-21일', 0],
    ['22-28일', 1000],
    ['29-29일', 2000],
  ])
})

test('sample report data stays inside the requested and previous month', () => {
  const sample = sampleReportTransactions('2026-02')

  assert.ok(sample.some((item) => item.date === '2026-02-28'))
  assert.ok(sample.some((item) => item.date.startsWith('2026-01-')))
  assert.ok(sample.every((item) => item.date.startsWith('2026-02-') || item.date.startsWith('2026-01-')))
  assert.equal(buildReport(sample, '2026-02').weeklyExpenses.length, 4)
  for (const item of sample) assert.deepEqual(validateTransaction(item), {})
})

test('preserves fractional percentages and negative difference when spending exceeds income', () => {
  const report = buildReport([
    { ...records[0], amount: 300 },
    { ...records[1], amount: 400 },
    { ...records[3], amount: 600 },
  ], '2026-01')
  assert.equal(report.summary.difference, -100)
  assert.ok(Math.abs(report.savingsRate! + 100 / 3) < 0.0001)
  assert.ok(Math.abs(report.expenseChangePercent! + 100 / 3) < 0.0001)
  assert.equal(report.weeklyExpenses.reduce((sum, week) => sum + week.amount, 0), report.summary.expenseTotal)
})
