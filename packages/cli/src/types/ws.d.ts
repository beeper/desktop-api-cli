declare module 'ws' {
  import type { IncomingHttpHeaders } from 'node:http'

  class WebSocket {
    static OPEN: number
    constructor(url: string | URL, options?: { headers?: Record<string, string> })
    readyState: number
    close(code?: number, reason?: string): void
    kill?: () => void
    addEventListener(event: 'open', listener: () => void): void
    addEventListener(event: 'message', listener: (event: { data: Buffer | string }) => void): void
    addEventListener(event: 'error', listener: (event: { error?: Error }) => void): void
    addEventListener(event: 'close', listener: (event: { code: number; reason: string }) => void): void
    once(event: 'open', listener: () => void): this
    once(event: 'error', listener: (error: Error) => void): this
    once(event: 'close', listener: (code: number, reason: Buffer) => void): this
    on(event: 'message', listener: (data: Buffer | string) => void): this
    send(data: string): void
  }

  export { WebSocket }
  export default WebSocket
}
