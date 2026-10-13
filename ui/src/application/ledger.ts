import { categories, monthOf } from '../domain/transaction.ts'
import type { MonthlySummary, Transaction, TransactionInput, TransactionType } from '../domain/transaction.ts'

export type TransactionFilter = {
  month: string
  type: TransactionType | 'all'
  categoryId: string
}

export function summarize(transactions: Transaction[], month: string): MonthlySummary {
  const current = transactions.filter((item) => monthOf(item.date) === month)
  const incomeTotal = current.filter((item) => item.type === 'income').reduce((sum, item) => sum + item.amount, 0)
  const expenseTotal = current.filter((item) => item.type === 'expense').reduce((sum, item) => sum + item.amount, 0)
  const expensesByCategory = categories
    .filter((category) => category.type === 'expense')
    .map((category) => ({
      category,
      amount: current.filter((item) => item.categoryId === category.id).reduce((sum, item) => sum + item.amount, 0),
    }))
    .filter((item) => item.amount > 0)
    .sort((a, b) => b.amount - a.amount)

  return { incomeTotal, expenseTotal, difference: incomeTotal - expenseTotal, expensesByCategory, transactionCount: current.length }
}

export function filterTransactions(transactions: Transaction[], filter: TransactionFilter): Transaction[] {
  return transactions
    .filter((item) => monthOf(item.date) === filter.month)
    .filter((item) => filter.type === 'all' || item.type === filter.type)
    .filter((item) => filter.categoryId === 'all' || item.categoryId === filter.categoryId)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
}

export type InputErrors = Partial<Record<keyof TransactionInput, string>>

export function validateTransaction(input: TransactionInput): InputErrors {
  const errors: InputErrors = {}
  const date = /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? new Date(`${input.date}T00:00:00Z`) : null
  if (!date || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== input.date) {
    errors.date = '올바른 거래일을 선택해 주세요.'
  }
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) errors.amount = '금액은 1원 이상의 정수여야 합니다.'
  if (!categories.some((category) => category.id === input.categoryId && category.type === input.type)) {
    errors.categoryId = '유형에 맞는 카테고리를 선택해 주세요.'
  }
  return errors
}
