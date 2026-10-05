import { validateTransaction } from '../application/ledger.ts'
import type { Transaction, TransactionInput } from '../domain/transaction.ts'

export const ledgerStorageKey = 'moa.transactions.v1'

type StoragePort = Pick<Storage, 'getItem' | 'setItem'>

function parseTransactions(value: string | null): Transaction[] {
  if (value === null) return []
  let parsed: unknown
  try { parsed = JSON.parse(value) }
  catch { throw new Error('저장된 거래 데이터를 읽을 수 없습니다.') }
  if (!Array.isArray(parsed) || !parsed.every((item) =>
    item && typeof item === 'object' && typeof item.id === 'string' &&
    typeof item.date === 'string' && (item.type === 'income' || item.type === 'expense') &&
    typeof item.amount === 'number' && typeof item.categoryId === 'string' &&
    typeof item.merchant === 'string' && typeof item.memo === 'string' &&
    Object.keys(validateTransaction(item as TransactionInput)).length === 0)) {
    throw new Error('저장된 거래 데이터의 형식이 올바르지 않습니다.')
  }
  return parsed as Transaction[]
}

export function createLocalLedger(storage: StoragePort) {
  const load = (): Transaction[] => parseTransactions(storage.getItem(ledgerStorageKey))
  const persist = (items: Transaction[]): Transaction[] => {
    try { storage.setItem(ledgerStorageKey, JSON.stringify(items)) }
    catch { throw new Error('브라우저에 거래를 저장하지 못했습니다. 저장 공간 설정을 확인해 주세요.') }
    return items
  }
  return {
    load,
    add(input: TransactionInput): Transaction[] {
      if (Object.keys(validateTransaction(input)).length) throw new Error('거래 입력을 확인해 주세요.')
      return persist([{ ...input, id: crypto.randomUUID() }, ...load()])
    },
    update(id: string, input: TransactionInput): Transaction[] {
      if (Object.keys(validateTransaction(input)).length) throw new Error('거래 입력을 확인해 주세요.')
      const items = load()
      if (!items.some((item) => item.id === id)) throw new Error('거래를 찾을 수 없습니다.')
      return persist(items.map((item) => item.id === id ? { ...input, id } : item))
    },
    remove(id: string): Transaction[] {
      const items = load()
      if (!items.some((item) => item.id === id)) throw new Error('거래를 찾을 수 없습니다.')
      return persist(items.filter((item) => item.id !== id))
    },
  }
}

export const localLedger = createLocalLedger({
  getItem: (key) => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
})
