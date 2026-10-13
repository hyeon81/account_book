import { categories } from '../domain/transaction.ts'
import type { Transaction, TransactionInput, TransactionType } from '../domain/transaction.ts'

export type RecommendationRequest = {
  type: TransactionType
  merchant: string
  memo: string
  history: { id: string; type: TransactionType; category_id: string; merchant: string; memo: string }[]
}
export type RecommendationEvidence = { id: string; category_id: string; source: 'category' | 'transaction'; text: string }
export type RecommendationResult = {
  status: 'recommended' | 'needs_clarification' | 'unavailable'
  category_id: string | null
  reason: string
  evidence_ids: string[]
  requires_confirmation: true
  evidence: RecommendationEvidence[]
}

export function recommendationRequest(input: TransactionInput, history: Transaction[], editing?: TransactionInput): RecommendationRequest {
  if (input.merchant.trim().length > 500 || input.memo.trim().length > 1000) throw new Error('AI 추천은 사용처 500자, 메모 1,000자까지 사용할 수 있어요. 내용을 줄이거나 카테고리를 직접 선택해 주세요.')
  const editingId = (editing as Transaction | undefined)?.id
  const request: RecommendationRequest = {
    type: input.type, merchant: input.merchant.trim(), memo: input.memo.trim(),
    history: history.filter((item) => item.type === input.type && categories.some((category) => category.id === item.categoryId && category.type === input.type))
      .filter((item) => !editing || (editingId ? item.id !== editingId :
        !(item.date === editing.date && item.amount === editing.amount && item.categoryId === editing.categoryId && item.merchant === editing.merchant && item.memo === editing.memo)))
      .sort((left, right) => right.date.localeCompare(left.date)).slice(0, 100)
      .map((item) => ({ id: item.id, type: item.type, category_id: item.categoryId, merchant: item.merchant.slice(0, 500), memo: item.memo.slice(0, 1000) })),
  }
  while (new TextEncoder().encode(JSON.stringify(request)).byteLength >= 190000 && request.history.length) request.history.pop()
  return request
}

export function validateRecommendation(value: unknown, request: RecommendationRequest, originalRequest?: RecommendationRequest): RecommendationResult {
  const invalid = () => { throw new Error('AI 추천의 근거를 확인하지 못했어요. 카테고리를 직접 선택하거나 다시 시도해 주세요.') }
  if (!value || typeof value !== 'object') return invalid()
  const result = value as RecommendationResult
  if (!['recommended', 'needs_clarification', 'unavailable'].includes(result.status) || result.requires_confirmation !== true ||
    typeof result.reason !== 'string' || !result.reason.trim() || result.reason.length > 500 ||
    !Array.isArray(result.evidence_ids) || result.evidence_ids.length > 5 || !result.evidence_ids.every((id) => typeof id === 'string') ||
    !Array.isArray(result.evidence) || result.evidence.length > 5) return invalid()
  const allowed = (id: unknown) => typeof id === 'string' && categories.some((item) => item.id === id && item.type === request.type)
  const seen = new Set<string>()
  for (const evidence of result.evidence) {
    if (!evidence || typeof evidence.id !== 'string' || seen.has(evidence.id) || !allowed(evidence.category_id) ||
      typeof evidence.text !== 'string' || !evidence.text.trim() || evidence.text.length > 2000) return invalid()
    seen.add(evidence.id)
    if (evidence.source === 'category') {
      if (evidence.id !== `category:${evidence.category_id}`) return invalid()
    } else if (evidence.source === 'transaction') {
      const current = request.history.find((item) => `transaction:${item.id}` === evidence.id && item.category_id === evidence.category_id)
      if (!current) return invalid()
      if (originalRequest) {
        const original = originalRequest.history.find((item) => item.id === current.id)
        if (!original || original.type !== current.type || original.category_id !== current.category_id ||
          original.merchant !== current.merchant || original.memo !== current.memo) return invalid()
      }
    } else return invalid()
  }
  if (new Set(result.evidence_ids).size !== result.evidence_ids.length || seen.size !== result.evidence_ids.length || !result.evidence_ids.every((id) => seen.has(id))) return invalid()
  if (result.status === 'recommended') {
    if (!allowed(result.category_id) || !result.evidence_ids.length ||
      !result.evidence.every((item) => item.category_id === result.category_id)) return invalid()
  } else if (result.category_id !== null) return invalid()
  return result
}

/** Each input change invalidates the response even if the transport ignores abort. */
export function createRecommendationGate() {
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
