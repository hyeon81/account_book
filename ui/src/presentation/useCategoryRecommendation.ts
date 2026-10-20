import { getBrowserDatasetId } from '@/infrastructure/browserDataset'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createRecommendationGate, recommendationRequest, validateRecommendation } from '@/application/categoryRecommendation'
import type { RecommendationResult } from '@/application/categoryRecommendation'
import type { TransactionInput } from '@/domain/transaction'
import { localLedger } from '@/infrastructure/localLedger'
import { requestCategoryRecommendation } from '@/infrastructure/categoryRecommendation'

export function useCategoryRecommendation(open: boolean, input: TransactionInput, editing: TransactionInput | undefined, select: (category: string) => void) {
  const gate = useRef(createRecommendationGate())
  const running = useRef(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<RecommendationResult | null>(null)
  const [notice, setNotice] = useState('')
  const cancel = useCallback(() => { gate.current.invalidate(); running.current = false; setBusy(false); setResult(null); setNotice('') }, [])
  // External dialog closure must abort transport and reset pending state before reopening.
  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => { if (!open) cancel() }, [open, cancel])
  useEffect(() => () => gate.current.invalidate(), [])
  const recommend = async () => {
    if (!open || running.current || (!input.merchant.trim() && !input.memo.trim())) return
    running.current = true
    const pending = gate.current.start()
    setBusy(true); setResult(null); setNotice('')
    try {
      const request = recommendationRequest(getBrowserDatasetId(), input, localLedger.load(), editing)
      const recommendation = await requestCategoryRecommendation(request, pending.signal)
      if (!pending.isCurrent()) return
      validateRecommendation(recommendation, recommendationRequest(getBrowserDatasetId(), input, localLedger.load(), editing), request)
      setResult(recommendation)
      if (recommendation.status === 'recommended' && recommendation.category_id) select(recommendation.category_id)
    } catch (cause) {
      if (pending.isCurrent()) setNotice(cause instanceof Error ? cause.message : 'AI 추천을 가져오지 못했어요.')
    } finally { if (pending.isCurrent()) { running.current = false; setBusy(false) } }
  }
  return { busy, result, notice, cancel, recommend }
}
