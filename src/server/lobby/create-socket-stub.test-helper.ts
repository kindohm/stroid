import { vi } from "vitest"

export type SocketStub = {
  sent: string[]
  listeners: Map<string, (data?: unknown) => void>
  send: (message: string) => void
  on: (event: string, listener: (data?: unknown) => void) => void
}

export const createSocket = (): SocketStub => {
  const listeners = new Map<string, (data?: unknown) => void>()
  const socket: SocketStub = {
    sent: [],
    listeners,
    send: vi.fn((message: string) => {
      socket.sent.push(message)
    }),
    on: vi.fn((event: string, listener: (data?: unknown) => void) => {
      listeners.set(event, listener)
    })
  }

  return socket
}
