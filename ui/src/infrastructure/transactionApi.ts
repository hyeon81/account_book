import { validateTransaction } from '../application/ledger.ts'
import type { Transaction, TransactionInput } from '../domain/transaction.ts'

type ImportResult = { imported: number; skipped: number }
type FetchPort = typeof fetch

function serialize(input: TransactionInput) {
  return { date: input.date, type: input.type, amount: input.amount, currency: 'KRW', category_id: input.categoryId, merchant: input.merchant, memo: input.memo }
}

function transaction(value: unknown): Transaction {
  if (!value || typeof value !== 'object') throw new Error('서버의 거래 응답을 확인할 수 없어요.')
  const row = value as Record<string, unknown>
  if (typeof row.id !== 'string' || !row.id || typeof row.date !== 'string' ||
    (row.type !== 'income' && row.type !== 'expense') || typeof row.amount !== 'number' ||
    typeof row.category_id !== 'string' || typeof row.merchant !== 'string' || typeof row.memo !== 'string' || row.currency !== 'KRW') {
    throw new Error('서버의 거래 응답을 확인할 수 없어요.')
  }
  const result: Transaction = { id: row.id, date: row.date, type: row.type, amount: row.amount, categoryId: row.category_id, merchant: row.merchant, memo: row.memo }
  if (Object.keys(validateTransaction(result)).length) throw new Error('서버의 거래 응답을 확인할 수 없어요.')
  return result
}

export function createTransactionApi(send: FetchPort = fetch, timeoutMs = 15000) {
  async function request(path: string, method = 'GET', body?: unknown, signal?: AbortSignal): Promise<unknown> {
    const controller = new AbortController()
    const abort = () => controller.abort()
    signal?.addEventListener('abort', abort, { once: true })
    if (signal?.aborted) abort()
    const timeout = setTimeout(abort, timeoutMs)
    try {
      const response = await send(path, { method, signal: controller.signal, headers: body === undefined ? undefined : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
      if (!response.ok) {
        let message = response.status === 503 ? '거래 저장소에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.' : '거래 요청에 실패했어요. 다시 시도해 주세요.'
        try {
          const value = await response.json()
          if (typeof value?.error?.message === 'string') message = value.error.message
        } catch { /* Keep a useful message when an intermediary returns non-JSON. */ }
        throw new Error(message)
      }
      return response.status === 204 ? undefined : await response.json()
    } catch (cause) {
      if (controller.signal.aborted) throw new Error('거래 요청이 취소되었거나 시간이 초과됐어요. 저장 여부를 다시 확인해 주세요.')
      if (cause instanceof TypeError || cause instanceof SyntaxError) throw new Error('거래 서버 응답을 확인할 수 없어요. 연결을 확인하고 다시 불러와 주세요.')
      throw cause
    } finally { clearTimeout(timeout); signal?.removeEventListener('abort', abort) }
  }
  return {
    async load(signal?: AbortSignal): Promise<Transaction[]> {
      const items: Transaction[] = []
      const seenCursors = new Set<string>()
      const seenIds = new Set<string>()
      let cursor: string | null = null
      do {
        const params = new URLSearchParams({ limit: '500' })
        if (cursor) params.set('cursor', cursor)
        const value = await request(`/api/transactions?${params}`, 'GET', undefined, signal) as { items?: unknown; next_cursor?: unknown }
        if (!value || !Array.isArray(value.items) || !(value.next_cursor === null || typeof value.next_cursor === 'string' && value.next_cursor)) {
          throw new Error('거래 목록 응답을 확인할 수 없어요.')
        }
        for (const row of value.items) {
          const item = transaction(row)
          if (seenIds.has(item.id)) throw new Error('조회 중 거래가 변경됐어요. 다시 불러와 주세요.')
          seenIds.add(item.id); items.push(item)
        }
        cursor = value.next_cursor
        if (cursor && seenCursors.has(cursor)) throw new Error('거래 목록을 끝까지 읽지 못했어요. 다시 불러와 주세요.')
        if (cursor) seenCursors.add(cursor)
      } while (cursor)
      return items
    },
    async add(input: TransactionInput): Promise<Transaction> {
      return transaction(await request('/api/transactions', 'POST', serialize(input)))
    },
    async update(id: string, input: TransactionInput): Promise<Transaction> {
      return transaction(await request(`/api/transactions/${encodeURIComponent(id)}`, 'PATCH', serialize(input)))
    },
    async remove(id: string): Promise<void> {
      await request(`/api/transactions/${encodeURIComponent(id)}`, 'DELETE')
    },
    async importItems(items: Transaction[]): Promise<ImportResult> {
      const total = { imported: 0, skipped: 0 }
      for (let index = 0; index < items.length;) {
        const batch: ReturnType<typeof serialize>[] = []
        while (index < items.length && batch.length < 100) {
          const next = { id: items[index].id, ...serialize(items[index]) }
          if (new TextEncoder().encode(JSON.stringify({ items: [...batch, next] })).byteLength > 190000) {
            if (!batch.length) throw new Error('가져올 거래의 내용이 너무 길어요. 브라우저 원본은 유지돼요.')
            break
          }
          batch.push(next); index++
        }
        const result = await request('/api/transactions/import', 'POST', { items: batch }) as ImportResult
        if (!result || !Number.isSafeInteger(result.imported) || !Number.isSafeInteger(result.skipped) || result.imported < 0 || result.skipped < 0 || result.imported + result.skipped !== batch.length) {
          throw new Error('가져오기 결과를 확인하지 못했어요. 원본을 유지했으니 다시 시도해 주세요.')
        }
        total.imported += result.imported; total.skipped += result.skipped
      }
      return total
    },
  }
}

export const transactionApi = createTransactionApi()
