import { categories, categoryFor, monthOf, seoulToday, shiftMonth, won } from '../domain/transaction.ts'
import type { Transaction, TransactionInput } from '../domain/transaction.ts'
import { summarize } from '../application/ledger.ts'

export type MockReply =
  | { kind: 'answer'; reply: string; detail: string }
  | { kind: 'clarification'; reply: string }
  | { kind: 'transaction_draft'; reply: string; draft: TransactionInput }

function dateFromMessage(message: string): string {
  const today = seoulToday()
  if (!message.includes('어제')) return today
  const date = new Date(`${today}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() - 1)
  return date.toISOString().slice(0, 10)
}

function matchCategory(message: string): string {
  if (/커피|카페|라떼|아메리카노/.test(message)) return 'cafe'
  if (/버스|지하철|택시|교통/.test(message)) return 'transport'
  if (/옷|쇼핑|구매/.test(message)) return 'shopping'
  if (/병원|약국|건강/.test(message)) return 'health'
  if (/월세|관리비|생활/.test(message)) return 'living'
  return 'food'
}

function amountFromMessage(message: string): number | null {
  const matched = message.match(/([\d,]+)\s*(만\s*)?원/)
  if (!matched) return null
  const amount = Number(matched[1].replaceAll(',', '')) * (matched[2] ? 10000 : 1)
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null
}

function answerFor(message: string, selectedMonth: string, transactions: Transaction[]): MockReply {
  const month = message.includes('지난달') ? shiftMonth(monthOf(seoulToday()), -1) :
    message.includes('이번 달') || message.includes('이번달') ? monthOf(seoulToday()) : selectedMonth
  const summary = summarize(transactions, month)
  const category = categories.find((item) => item.type === 'expense' && message.includes(item.name))
  const amount = category
    ? summary.expensesByCategory.find((item) => item.category.id === category.id)?.amount ?? 0
    : summary.expenseTotal
  const label = category ? `${category.name} 지출` : '전체 지출'
  return {
    kind: 'answer',
    reply: summary.transactionCount === 0
      ? `${month}에는 기록된 거래가 없어요.`
      : `${month} ${label}은 ${won(amount)}이에요.`,
    detail: `${month} · ${category ? `${category.name} 카테고리` : '모든 지출'} · 저장된 거래 기준`,
  }
}

export const scriptedAssistant = {
  async ask(message: string, selectedMonth: string, transactions: Transaction[]): Promise<MockReply> {
    await new Promise((resolve) => setTimeout(resolve, 380))
    if (message.includes('오류 테스트')) throw new Error('도우미 응답을 불러오지 못했어요. 다시 시도해 주세요.')
    if (/얼마|합계|내역|썼지|사용했/.test(message) && !/썼어|결제했어/.test(message)) {
      return answerFor(message, selectedMonth, transactions)
    }
    const amount = amountFromMessage(message)
    if (!amount) return { kind: 'clarification', reply: '금액을 알려주시면 거래 초안을 만들게요. 예: 점심에 12,000원 썼어' }
    const income = /받았|입금|월급|급여|수입/.test(message)
    const categoryId = income ? 'salary' : matchCategory(message)
    const category = categoryFor(categoryId)!
    return {
      kind: 'transaction_draft',
      reply: `${category.name} ${income ? '수입' : '지출'} 초안을 만들었어요. 저장하기 전에 내용을 확인해 주세요.`,
      draft: {
        date: dateFromMessage(message), type: income ? 'income' : 'expense', amount,
        categoryId, merchant: '', memo: message.trim(),
      },
    }
  },
}
