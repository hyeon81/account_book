import { categories, seoulToday } from '../domain/transaction.ts'
import type { Transaction, TransactionInput, TransactionType } from '../domain/transaction.ts'
import { validateRecommendation } from './categoryRecommendation.ts'
import type { RecommendationRequest, RecommendationResult } from './categoryRecommendation.ts'

export type TransactionDraftRequest = {
  message: string
  reference_date: string
  timezone: 'Asia/Seoul'
  history: { id: string; type: TransactionType; category_id: string; merchant: string; memo: string }[]
}

export type TransactionDraftResult = {
  status: 'draft' | 'needs_clarification' | 'unavailable'
  draft: TransactionInput | null
  reason: string
  recommendation: RecommendationResult | null
  requires_confirmation: true
}

const validDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

export function transactionDraftRequest(message: string, history: Transaction[], referenceDate = seoulToday()): TransactionDraftRequest {
  const text = message.trim()
  if (!text || text.length > 4000) throw new Error('거래 문장은 4,000자까지 보낼 수 있어요.')
  if (!validDate(referenceDate)) throw new Error('기준 날짜를 확인해 주세요.')
  const request: TransactionDraftRequest = {
    message: text,
    reference_date: referenceDate,
    timezone: 'Asia/Seoul',
    history: history
      .filter((item) => categories.some((category) => category.id === item.categoryId && category.type === item.type))
      .sort((left, right) => right.date.localeCompare(left.date))
      .slice(0, 100)
      .map((item) => ({ id: item.id, type: item.type, category_id: item.categoryId, merchant: item.merchant.slice(0, 500), memo: item.memo.slice(0, 1000) })),
  }
  while (new TextEncoder().encode(JSON.stringify(request)).byteLength >= 190000 && request.history.length) request.history.pop()
  return request
}

function recommendationSnapshot(draft: TransactionInput, request: TransactionDraftRequest): RecommendationRequest {
  return {
    type: draft.type,
    merchant: draft.merchant,
    memo: draft.memo,
    history: request.history.filter((item) => item.type === draft.type),
  }
}

export function validateTransactionDraft(value: unknown, request: TransactionDraftRequest, latestRequest = request): TransactionDraftResult {
  const invalid = () => { throw new Error('AI 초안을 확인하지 못했어요. 직접 입력하거나 다시 시도해 주세요.') }
  if (!value || typeof value !== 'object') return invalid()
  const result = value as TransactionDraftResult
  if (!['draft', 'needs_clarification', 'unavailable'].includes(result.status) ||
    result.requires_confirmation !== true || typeof result.reason !== 'string' ||
    !result.reason.trim() || result.reason.length > 500) return invalid()
  if (result.status !== 'draft') {
    if (result.draft !== null || result.recommendation !== null) return invalid()
    return result
  }
  const draft = result.draft
  if (!draft || !validDate(draft.date) || !['income', 'expense'].includes(draft.type) ||
    typeof draft.amount !== 'number' || !Number.isSafeInteger(draft.amount) || draft.amount <= 0 ||
    typeof draft.merchant !== 'string' || draft.merchant.length > 500 ||
    typeof draft.memo !== 'string' || draft.memo.length > 1000 ||
    typeof draft.categoryId !== 'string' || (draft.categoryId && !categories.some((item) => item.id === draft.categoryId && item.type === draft.type)) ||
    !result.recommendation) return invalid()
  const recommendation = validateRecommendation(result.recommendation, recommendationSnapshot(draft, latestRequest), recommendationSnapshot(draft, request))
  if (recommendation.status === 'recommended') {
    if (recommendation.category_id !== draft.categoryId) return invalid()
  } else if (draft.categoryId) return invalid()
  return { ...result, recommendation }
}

export function createTransactionDraftGate() {
  let generation = 0
  let controller: AbortController | undefined
  const invalidate = () => { generation += 1; controller?.abort(); controller = undefined }
  return {
    invalidate,
    start() {
      invalidate()
      controller = new AbortController()
      const current = generation
      return { signal: controller.signal, isCurrent: () => current === generation && !controller?.signal.aborted }
    },
  }
}
