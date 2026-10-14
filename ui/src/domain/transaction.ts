export type TransactionType = 'income' | 'expense'

export type Category = {
  id: string
  name: string
  type: TransactionType
  color: string
  icon: string
}

export type Transaction = {
  id: string
  date: string
  type: TransactionType
  amount: number
  categoryId: string
  merchant: string
  memo: string
}

export type TransactionInput = Omit<Transaction, 'id'>

export type CategoryTotal = { category: Category; amount: number }

export type MonthlySummary = {
  incomeTotal: number
  expenseTotal: number
  difference: number
  expensesByCategory: CategoryTotal[]
  transactionCount: number
}

export const categories: Category[] = [
  { id: 'salary', name: '급여', type: 'income', color: '#6878ad', icon: '↗' },
  { id: 'other-income', name: '기타 수입', type: 'income', color: '#8a95ba', icon: '↗' },
  { id: 'food', name: '식비', type: 'expense', color: '#e89478', icon: '◒' },
  { id: 'cafe', name: '카페', type: 'expense', color: '#b98c7f', icon: '◔' },
  { id: 'shopping', name: '쇼핑', type: 'expense', color: '#a48fb3', icon: '◇' },
  { id: 'transport', name: '교통', type: 'expense', color: '#86a8a2', icon: '↗' },
  { id: 'living', name: '생활', type: 'expense', color: '#c5ac78', icon: '⌂' },
  { id: 'health', name: '건강', type: 'expense', color: '#8aabb6', icon: '+' },
]

export function categoryFor(id: string): Category | undefined {
  return categories.find((category) => category.id === id)
}

export function won(amount: number): string {
  return `${new Intl.NumberFormat('ko-KR').format(amount)}원`
}

export function seoulToday(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${byType.year}-${byType.month}-${byType.day}`
}

export function monthOf(date: string): string {
  return date.slice(0, 7)
}

export function shiftMonth(month: string, delta: number): string {
  const [year, number] = month.split('-').map(Number)
  const result = new Date(Date.UTC(year, number - 1 + delta, 1))
  return `${result.getUTCFullYear()}-${String(result.getUTCMonth() + 1).padStart(2, '0')}`
}

export function monthLabel(month: string): string {
  const [year, number] = month.split('-')
  return `${year}년 ${Number(number)}월`
}

export function dateLabel(date: string): string {
  const [year, month, day] = date.split('-')
  return `${year}.${month}.${day}`
}
