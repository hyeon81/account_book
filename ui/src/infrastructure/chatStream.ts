import type { MockReply } from './scriptedAssistant.ts'

export type ChatTable = { name: string; rows: Record<string, string | number | null>[] }
type ChatMessage = { reply: string; tables: ChatTable[]; stop_reason: string }

const invalid = () => new Error('통계 응답을 읽지 못했어요. 다시 시도해 주세요.')
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function message(value: unknown): ChatMessage {
  if (!record(value) || typeof value.reply !== 'string' || value.reply.length > 30000 ||
    typeof value.stop_reason !== 'string' || !Array.isArray(value.tables) || value.tables.length > 30) throw invalid()
  for (const table of value.tables) {
    if (!record(table) || typeof table.name !== 'string' || !Array.isArray(table.rows) || table.rows.length > 100) throw invalid()
    for (const row of table.rows) {
      if (!record(row) || Object.keys(row).length > 30 || !Object.values(row).every((cell) =>
        cell === null || typeof cell === 'string' || (typeof cell === 'number' && Number.isFinite(cell)))) throw invalid()
    }
  }
  return value as ChatMessage
}

function detail(tables: ChatTable[]): string {
  const labels: Record<string, string> = {
    count_frequency: '결제 빈도', compare_periods: '기간 비교', search_transactions: '거래 내역',
    payment_count: '결제 건수', active_days: '거래가 있던 날짜 수', average_interval_days: '평균 간격(일)',
    average_amount: '회당 평균 금액(원)', category_id: '카테고리', a_total: 'A 합계(원)', b_total: 'B 합계(원)',
    difference: '차액(원)', change_rate_percent: '증감률(%)', merchant: '사용처', memo: '메모', date: '거래일',
    amount: '금액(원)', type: '유형', currency: '통화', basis: '집계 기준',
  }
  return tables.map((table) => `${labels[table.name] ?? table.name}: ${table.rows.map((row) =>
    Object.entries(row).map(([key, value]) => `${labels[key] ?? key}: ${value ?? '—'}`).join(' · ')).join(' / ')}`).join(' | ')
}

/** Accept only the public query events; tool arguments never enter UI state. */
export async function readChatStream(response: Response): Promise<MockReply> {
  if (!response.ok || !response.headers.get('content-type')?.includes('text/event-stream') || !response.body) throw invalid()
  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let buffer = '', size = 0, answer: ChatMessage | undefined, done = false
  const event = (block: string) => {
    if (!block.trim() || block.split(/\r?\n/).every((line) => !line || line.startsWith(':'))) return
    if (done) throw invalid()
    let name = 'message'
    const data: string[] = []
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith('event:')) name = line.slice(6).trim()
      else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''))
    }
    const value: unknown = data.length ? JSON.parse(data.join('\n')) : null
    if (name === 'error') throw new Error('통계 조회에 실패했어요. 잠시 후 다시 시도해 주세요.')
    if (name === 'tool') {
      if (answer || !record(value) || Object.keys(value).length !== 1 ||
        !['search_transactions', 'count_frequency', 'compare_periods'].includes(String(value.name))) throw invalid()
    } else if (name === 'message') {
      if (answer) throw invalid()
      answer = message(value)
    } else if (name === 'done') {
      if (!answer) throw invalid()
      done = true
    } else throw invalid()
  }
  try {
    while (!done) {
      const chunk = await reader.read()
      if (chunk.done) break
      size += chunk.value.byteLength
      if (size > 1024 * 1024) throw invalid()
      buffer += decoder.decode(chunk.value, { stream: true })
      let boundary: RegExpExecArray | null
      while ((boundary = /\r?\n\r?\n/.exec(buffer))) {
        event(buffer.slice(0, boundary.index))
        buffer = buffer.slice(boundary.index + boundary[0].length)
      }
    }
    if (!done || !answer) throw invalid()
    return { kind: 'answer', reply: answer.reply, detail: detail(answer.tables) }
  } catch (cause) {
    if (cause instanceof Error && cause.message.startsWith('통계')) throw cause
    throw invalid()
  } finally { await reader.cancel().catch(() => undefined); reader.releaseLock() }
}
