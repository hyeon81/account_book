import type { Transaction } from '../domain/transaction.ts'
import { scriptedAssistant } from './scriptedAssistant.ts'
import type { MockReply } from './scriptedAssistant.ts'
import { ChatAgent } from './chatAgent.ts'

type Assistant = { ask(message: string, month: string, transactions: Transaction[]): Promise<MockReply> }

export function createAssistant(send: typeof fetch = fetch, scripted: Assistant = scriptedAssistant): Assistant {
  const real = new ChatAgent(send)
  return {
    async ask(message, month, transactions) {
      let response: Response
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 30000)
      try { response = await send('/api/chat/config', { headers: { Accept: 'application/json' }, signal: controller.signal }) }
      catch { throw new Error('도우미 연결 설정을 불러오지 못했어요. 다시 시도해 주세요.') }
      finally { clearTimeout(timeout) }
      if (!response.ok) throw new Error('도우미 연결 설정을 불러오지 못했어요. 다시 시도해 주세요.')
      let value: unknown
      try { value = await response.json() }
      catch { throw new Error('도우미 연결 설정을 읽지 못했어요. 다시 시도해 주세요.') }
      if (typeof value !== 'object' || value === null || !('enabled' in value) || typeof value.enabled !== 'boolean') {
        throw new Error('도우미 연결 설정을 확인해 주세요.')
      }
      return (value.enabled ? real : scripted).ask(message, month, transactions)
    },
  }
}

export const assistant = createAssistant()
