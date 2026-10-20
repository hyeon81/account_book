import { validateDatasetId } from '../application/datasetId.ts'

export const datasetStorageKey = 'moa.ai.dataset-id.v1'
type StoragePort = Pick<Storage, 'getItem' | 'setItem'>

/** A browser dataset label, not an authentication or authorization credential. */
export function getBrowserDatasetId(
  storage: StoragePort = window.localStorage,
  createId: () => string = () => crypto.randomUUID(),
): string {
  try {
    const saved = storage.getItem(datasetStorageKey)
    if (saved !== null) return validateDatasetId(saved)
    const created = validateDatasetId(createId())
    storage.setItem(datasetStorageKey, created)
    return created
  } catch {
    throw new Error('AI 자료 구분값을 저장하거나 읽지 못했어요. 브라우저 저장 공간을 확인하거나 직접 입력해 주세요.')
  }
}
