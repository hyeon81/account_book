import test from 'node:test'
import assert from 'node:assert/strict'
import { createLocalLedger, ledgerStorageKey } from '../../src/infrastructure/localLedger.ts'
import { seoulToday } from '../../src/domain/transaction.ts'

function memoryStorage() {
  const data = new Map<string, string>()
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value) },
  }
}

const input = () => ({
  date: seoulToday(), type: 'expense' as const, amount: 12000,
  categoryId: 'food', merchant: '식당', memo: '점심',
})

test('create, edit and delete survive repository recreation', () => {
  const storage = memoryStorage()
  const ledger = createLocalLedger(storage)
  const created = ledger.add(input())
  assert.equal(createLocalLedger(storage).load()[0].amount, 12000)
  ledger.update(created[0].id, { ...input(), amount: 15000 })
  assert.equal(createLocalLedger(storage).load()[0].amount, 15000)
  ledger.remove(created[0].id)
  assert.deepEqual(createLocalLedger(storage).load(), [])
})

test('invalid data is rejected without overwriting stored transactions', () => {
  const storage = memoryStorage()
  const ledger = createLocalLedger(storage)
  ledger.add(input())
  const before = storage.getItem(ledgerStorageKey)
  assert.throws(() => ledger.add({ ...input(), amount: 0 }), /거래 입력/)
  assert.equal(storage.getItem(ledgerStorageKey), before)
  storage.setItem(ledgerStorageKey, '{broken')
  assert.throws(() => ledger.load(), /읽을 수 없습니다/)
  assert.equal(storage.getItem(ledgerStorageKey), '{broken')
})

test('failed storage write does not report success', () => {
  const ledger = createLocalLedger({
    getItem: () => null,
    setItem: () => { throw new Error('quota') },
  })
  assert.throws(() => ledger.add(input()), /저장하지 못했습니다/)
})
