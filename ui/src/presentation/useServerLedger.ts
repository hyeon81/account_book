import { useCallback, useEffect, useRef, useState } from 'react'
import type { Transaction, TransactionInput } from '@/domain/transaction'
import { transactionApi } from '@/infrastructure/transactionApi'

export function useServerLedger() {
  const [items, setItems] = useState<Transaction[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false)
  const running = useRef(false)
  const generation = useRef(0)
  const activeLoad = useRef<AbortController | null>(null)
  const reload = useCallback(async () => {
    if (running.current) return
    activeLoad.current?.abort()
    const controller = new AbortController()
    activeLoad.current = controller
    const version = ++generation.current
    setLoading(true); setError(''); setReady(false)
    try {
      const result = await transactionApi.load(controller.signal)
      if (version === generation.current) { setItems(result); setReady(true) }
    } catch (cause) {
      if (version === generation.current) setError(cause instanceof Error ? cause.message : '거래를 불러오지 못했어요.')
    } finally { if (version === generation.current) setLoading(false) }
  }, [])
  useEffect(() => {
    // Initial loading synchronizes the screen with the server, including Strict Mode remounts.
    // oxlint-disable-next-line react/set-state-in-effect
    void reload()
    const pending = activeLoad.current
    // This ref is a request generation counter, not a DOM ref; invalidate late results on unmount.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    return () => { ++generation.current; pending?.abort() }
  }, [reload])
  async function mutate<T>(operation: () => Promise<T>, apply: (value: T) => void): Promise<T> {
    if (!ready || loading || running.current) throw new Error('거래를 불러오거나 저장하고 있어요. 잠시 후 다시 시도해 주세요.')
    running.current = true; setBusy(true)
    try {
      const value = await operation()
      apply(value)
      return value
    } finally { running.current = false; setBusy(false) }
  }
  return {
    items, error, loading, busy, ready, reload,
    add: (input: TransactionInput) => mutate(() => transactionApi.add(input), (row) => setItems((current) => [row, ...current])),
    update: (id: string, input: TransactionInput) => mutate(() => transactionApi.update(id, input), (row) => setItems((current) => current.map((item) => item.id === id ? row : item))),
    remove: (id: string) => mutate(() => transactionApi.remove(id), () => setItems((current) => current.filter((item) => item.id !== id))),
    importItems: (rows: Transaction[]) => mutate(() => transactionApi.importItems(rows), () => {}),
  }
}
