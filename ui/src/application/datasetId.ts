export function validateDatasetId(value: string): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error('AI 자료 구분값을 확인하지 못했어요. 직접 입력하거나 다시 시도해 주세요.')
  }
  return value.toLowerCase()
}
