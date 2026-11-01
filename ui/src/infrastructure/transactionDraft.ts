import { validateTransactionDraft } from '../application/transactionDraft.ts'
import type { TransactionDraftRequest, TransactionDraftResult } from '../application/transactionDraft.ts'

type FetchPort = typeof fetch

export async function requestTransactionDraft(request: TransactionDraftRequest, signal: AbortSignal, send: FetchPort = fetch, timeoutMs = 95000): Promise<TransactionDraftResult> {
  const controller = new AbortController()
  let timedOut = false
  const abort = () => controller.abort()
  signal.addEventListener('abort', abort, { once: true })
  if (signal.aborted) abort()
  const timeout = setTimeout(() => { timedOut = true; abort() }, timeoutMs)
  try {
    let response: Response
    try {
      response = await send('/api/transaction-draft', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request), signal: controller.signal,
      })
    } catch (cause) {
      if (signal.aborted) throw cause
      if (timedOut) throw new Error('AI 초안 작성 시간이 초과됐어요. 다시 시도하거나 직접 입력해 주세요.')
      throw new Error('AI 서버에 연결하지 못했어요. 연결을 확인하거나 직접 입력해 주세요.')
    }
    if (!response.ok) throw new Error(response.status === 503
      ? 'AI 초안을 사용할 수 없어요. 서비스 설정을 확인하거나 직접 입력해 주세요.'
      : response.status === 400 ? '문장과 거래 내역을 확인한 뒤 다시 채워 주세요.' : 'AI 초안 작성에 실패했어요. 잠시 후 다시 시도해 주세요.')
    let value: unknown
    try { value = await response.json() }
    catch {
      if (signal.aborted) throw new Error('요청이 취소됐어요.')
      if (timedOut) throw new Error('AI 초안 작성 시간이 초과됐어요. 다시 시도하거나 직접 입력해 주세요.')
      throw new Error('AI 응답을 읽지 못했어요. 직접 입력하거나 다시 시도해 주세요.')
    }
    return validateTransactionDraft(value, request)
  } finally { clearTimeout(timeout); signal.removeEventListener('abort', abort) }
}
