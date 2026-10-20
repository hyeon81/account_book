import test from 'node:test'
import assert from 'node:assert/strict'
import { datasetStorageKey, getBrowserDatasetId } from '../../src/infrastructure/browserDataset.ts'
import { ledgerStorageKey } from '../../src/infrastructure/localLedger.ts'

const firstId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const secondId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const memoryStorage = () => {
  const values = new Map<string, string>()
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) } }
}

test('dataset UUID persists across requests and new helper instances without touching transactions', () => {
  const storage = memoryStorage()
  storage.setItem(ledgerStorageKey, '[{"id":"saved"}]')
  assert.equal(getBrowserDatasetId(storage, () => firstId), firstId)
  assert.equal(storage.getItem(datasetStorageKey), firstId)
  assert.equal(getBrowserDatasetId(storage, () => { throw new Error('must reuse') }), firstId)
  assert.equal(storage.getItem(ledgerStorageKey), '[{"id":"saved"}]')
  assert.equal(getBrowserDatasetId(memoryStorage(), () => secondId), secondId)
})

test('unreadable, unwritable or invalid dataset storage fails before an AI request', () => {
  const storage = memoryStorage()
  storage.setItem(datasetStorageKey, 'not-a-uuid')
  assert.throws(() => getBrowserDatasetId(storage, () => firstId), /직접 입력/)
  assert.throws(() => getBrowserDatasetId({ getItem: () => { throw new Error('denied') }, setItem: () => {} }), /직접 입력/)
  assert.throws(() => getBrowserDatasetId({ getItem: () => null, setItem: () => { throw new Error('full') } }, () => firstId), /직접 입력/)
  assert.throws(() => getBrowserDatasetId(memoryStorage(), () => 'invalid'), /직접 입력/)
})
