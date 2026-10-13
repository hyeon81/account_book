import { summarize } from './ledger.ts'
import { monthOf, shiftMonth } from '../domain/transaction.ts'
import type { MonthlySummary, Transaction } from '../domain/transaction.ts'

export type WeeklyExpense = { label: string; amount: number }

export type Report = {
  summary: MonthlySummary
  previousSummary: MonthlySummary
  expenseChangePercent: number | null
  savingsRate: number | null
  weeklyExpenses: WeeklyExpense[]
}

export function buildReport(transactions: Transaction[], month: string): Report {
  const summary = summarize(transactions, month)
  const previousSummary = summarize(transactions, shiftMonth(month, -1))
  return {
    summary,
    previousSummary,
    expenseChangePercent: previousSummary.expenseTotal > 0
      ? (summary.expenseTotal - previousSummary.expenseTotal) / previousSummary.expenseTotal * 100
      : null,
    savingsRate: summary.incomeTotal > 0 ? summary.difference / summary.incomeTotal * 100 : null,
    weeklyExpenses: weeklyExpenseBuckets(transactions, month),
  }
}

export function sampleReportTransactions(month: string): Transaction[] {
  const previous = shiftMonth(month, -1)
  return [
    transaction('sample-income-current', dateInMonth(month, 5), 'income', 3200000, 'salary', '회사', '월급'),
    transaction('sample-food-1', dateInMonth(month, 3), 'expense', 42000, 'food', '점심 식당', '동료 점심'),
    transaction('sample-cafe-1', dateInMonth(month, 8), 'expense', 15500, 'cafe', '카페 모아', '회의'),
    transaction('sample-transport-1', dateInMonth(month, 12), 'expense', 62000, 'transport', '교통카드', '충전'),
    transaction('sample-shopping-1', dateInMonth(month, 17), 'expense', 128000, 'shopping', '온라인몰', '생활용품'),
    transaction('sample-living-1', dateInMonth(month, 23), 'expense', 186000, 'living', '관리비', '주거'),
    transaction('sample-health-1', dateInMonth(month, 29), 'expense', 36000, 'health', '약국', '상비약'),
    transaction('sample-income-prev', dateInMonth(previous, 5), 'income', 3200000, 'salary', '회사', '월급'),
    transaction('sample-prev-food', dateInMonth(previous, 4), 'expense', 215000, 'food', '식비', '지난달 식비'),
    transaction('sample-prev-cafe', dateInMonth(previous, 9), 'expense', 72000, 'cafe', '카페', '지난달 카페'),
    transaction('sample-prev-shopping', dateInMonth(previous, 16), 'expense', 168000, 'shopping', '쇼핑', '지난달 쇼핑'),
    transaction('sample-prev-living', dateInMonth(previous, 22), 'expense', 196000, 'living', '생활비', '지난달 생활'),
  ]
}

function weeklyExpenseBuckets(transactions: Transaction[], month: string): WeeklyExpense[] {
  const days = daysInMonth(month)
  return [
    { label: '1-7일', from: 1, to: 7 },
    { label: '8-14일', from: 8, to: 14 },
    { label: '15-21일', from: 15, to: 21 },
    { label: '22-28일', from: 22, to: 28 },
    { label: `29-${days}일`, from: 29, to: days },
  ]
    .filter((bucket) => bucket.from <= days)
    .map((bucket) => ({
      label: bucket.label,
      amount: transactions
        .filter((item) => item.type === 'expense' && monthOf(item.date) === month)
        .filter((item) => {
          const day = Number(item.date.slice(8, 10))
          return day >= bucket.from && day <= bucket.to
        })
        .reduce((sum, item) => sum + item.amount, 0),
    }))
}

function daysInMonth(month: string): number {
  const [year, number] = month.split('-').map(Number)
  return new Date(Date.UTC(year, number, 0)).getUTCDate()
}

function dateInMonth(month: string, day: number): string {
  return `${month}-${String(Math.min(day, daysInMonth(month))).padStart(2, '0')}`
}

function transaction(
  id: string,
  date: string,
  type: Transaction['type'],
  amount: number,
  categoryId: string,
  merchant: string,
  memo: string,
): Transaction {
  return { id, date, type, amount, categoryId, merchant, memo }
}
