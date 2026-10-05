import { filterTransactions, summarize, validateTransaction } from '../application/ledger.ts'
import type { TransactionFilter } from '../application/ledger.ts'
import { monthOf, seoulToday, shiftMonth } from '../domain/transaction.ts'
import type { MonthlySummary, Transaction, TransactionInput } from '../domain/transaction.ts'

function seedTransactions(): Transaction[] {
  const today = seoulToday()
  const month = monthOf(today)
  const previous = shiftMonth(month, -1)
  const day = (number: number) => `${month}-${String(Math.min(number, Number(today.slice(8)))).padStart(2, '0')}`
  return [
    { id: 'seed-1', date: day(2), type: 'income', amount: 3200000, categoryId: 'salary', merchant: '회사', memo: '월급' },
    { id: 'seed-2', date: day(3), type: 'expense', amount: 520000, categoryId: 'living', merchant: '월세', memo: `${Number(month.slice(5))}월 주거비` },
    { id: 'seed-3', date: day(4), type: 'expense', amount: 48000, categoryId: 'food', merchant: '동네 마트', memo: '주말 장보기' },
    { id: 'seed-4', date: day(5), type: 'expense', amount: 6800, categoryId: 'cafe', merchant: '카페 온도', memo: '아이스 라떼' },
    { id: 'seed-5', date: day(5), type: 'expense', amount: 14500, categoryId: 'food', merchant: '소담 식당', memo: '점심' },
    { id: 'seed-6', date: day(5), type: 'expense', amount: 1250, categoryId: 'transport', merchant: '지하철', memo: '' },
    { id: 'seed-7', date: `${previous}-28`, type: 'expense', amount: 78000, categoryId: 'shopping', merchant: '온라인 쇼핑', memo: '' },
    { id: 'seed-8', date: `${previous}-25`, type: 'income', amount: 3200000, categoryId: 'salary', merchant: '회사', memo: '월급' },
  ]
}

let transactions = seedTransactions()
let nextId = 1

export const mockLedger = {
  list(filter: TransactionFilter): Transaction[] {
    return filterTransactions(transactions, filter)
  },
  summary(month: string): MonthlySummary {
    return summarize(transactions, month)
  },
  add(input: TransactionInput): Transaction {
    const errors = validateTransaction(input)
    if (Object.keys(errors).length) throw new Error('거래 입력을 확인해 주세요.')
    const created = { ...input, id: `mock-${nextId++}` }
    transactions = [created, ...transactions]
    return created
  },
  update(id: string, input: TransactionInput): Transaction {
    if (!transactions.some((item) => item.id === id)) throw new Error('거래를 찾을 수 없습니다.')
    const errors = validateTransaction(input)
    if (Object.keys(errors).length) throw new Error('거래 입력을 확인해 주세요.')
    const updated = { ...input, id }
    transactions = transactions.map((item) => item.id === id ? updated : item)
    return updated
  },
  remove(id: string): void {
    if (!transactions.some((item) => item.id === id)) throw new Error('거래를 찾을 수 없습니다.')
    transactions = transactions.filter((item) => item.id !== id)
  },
}
