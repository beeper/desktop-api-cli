export type APIRecord = Record<string, unknown>

export function apiRecord(value: unknown): APIRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as APIRecord : {}
}

export function apiItems(value: unknown): APIRecord[] {
  if (Array.isArray(value)) return value.map(apiRecord)
  const items = apiRecord(value).items
  return Array.isArray(items) ? items.map(apiRecord) : []
}
