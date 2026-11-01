import type { Transaction } from '../domain/transaction.ts'
import type { MockReply } from './scriptedAssistant.ts'
import { readChatStream } from './chatStream.ts'

export class ChatAgent {
  private send: typeof fetch
  private timeoutMs: number

  constructor(send: typeof fetch = fetch, timeoutMs = 30000) {
    this.send = send
    this.timeoutMs = timeoutMs
  }

  async ask(message: string, _selectedMonth: string, _transactions: Transaction[]): Promise<MockReply> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const response = await this.send('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify({ message }), signal: controller.signal,
      })
      return await readChatStream(response)
    } catch (cause) {
      if (controller.signal.aborted) throw new Error('통계 조회 시간이 초과됐어요. 다시 시도해 주세요.')
      if (cause instanceof Error && cause.message.startsWith('통계')) throw cause
      throw new Error('통계 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.')
    } finally { clearTimeout(timeout) }
  }
}
