import { resolveTarget } from './targets.js'

export async function appRequest<T>(
  method: string,
  path: string,
  options: { baseURL?: string; body?: Record<string, unknown>; token?: string | false; target?: string } = {},
): Promise<T> {
  const target = await resolveTarget({ target: options.target, baseURL: options.baseURL })
  const token = options.token === false
    ? undefined
    : options.token ?? process.env.BEEPER_ACCESS_TOKEN ?? target.auth?.accessToken
  const headers: Record<string, string> = {}
  if (token) headers.authorization = `Bearer ${token}`
  if (options.body) headers['content-type'] = 'application/json'

  const response = await fetch(new URL(path, target.baseURL), {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
  if (!response.ok) throw new Error(`${method} ${path} failed: ${response.status} ${await response.text()}`)
  if (response.status === 204) return undefined as T
  const text = await response.text()
  return (text ? JSON.parse(text) : {}) as T
}
