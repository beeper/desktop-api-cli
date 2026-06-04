export async function collectPage<T>(iterable: AsyncIterable<T>, limit?: number): Promise<T[]> {
  if (limit !== undefined && limit <= 0) return []
  const items: T[] = []
  for await (const item of iterable) {
    items.push(item)
    if (limit !== undefined && items.length >= limit) break
  }
  return items
}
