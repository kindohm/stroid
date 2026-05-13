import { describe, expect, it, vi } from "vitest"
import { createLobby } from "./lobby"

type SocketStub = {
  sent: string[]
  listeners: Map<string, (data?: unknown) => void>
  send: (message: string) => void
  on: (event: string, listener: (data?: unknown) => void) => void
}

const createSocket = (): SocketStub => {
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

describe("createLobby", () => {
  it("broadcasts joined players to lobby clients", () => {
    const lobby = createLobby()
    const first = createSocket()
    const second = createSocket()

    lobby.addClient(first as never)
    lobby.addClient(second as never)

    first.listeners.get("message")?.(JSON.stringify({ type: "joinLobby", username: "mike" }))
    second.listeners.get("message")?.(JSON.stringify({ type: "joinLobby", username: "zoe" }))

    const latest = JSON.parse(first.sent.at(-1) ?? "{}") as {
      players: Array<{ username: string }>
    }

    expect(latest.players.map((player) => player.username)).toEqual(["mike", "zoe"])
  })

  it("broadcasts game start to joined lobby clients", () => {
    const lobby = createLobby()
    const first = createSocket()
    const second = createSocket()

    lobby.addClient(first as never)
    lobby.addClient(second as never)

    first.listeners.get("message")?.(JSON.stringify({ type: "joinLobby", username: "mike" }))
    second.listeners.get("message")?.(JSON.stringify({ type: "joinLobby", username: "zoe" }))
    first.listeners.get("message")?.(JSON.stringify({ type: "startGame" }))

    const firstStarted = JSON.parse(first.sent.at(-1) ?? "{}") as { type: string }
    const secondStarted = JSON.parse(second.sent.at(-1) ?? "{}") as { type: string }

    expect(firstStarted.type).toBe("gameStarted")
    expect(secondStarted.type).toBe("gameStarted")
    lobby.stop()
  })

  it("updates usernames but ignores blank rename attempts", () => {
    const lobby = createLobby()
    const socket = createSocket()

    lobby.addClient(socket as never)

    socket.listeners.get("message")?.(JSON.stringify({ type: "joinLobby", username: "mike" }))
    socket.listeners.get("message")?.(JSON.stringify({ type: "joinLobby", username: "mika" }))
    socket.listeners.get("message")?.(JSON.stringify({ type: "joinLobby", username: "   " }))

    const latest = JSON.parse(socket.sent.at(-1) ?? "{}") as {
      players: Array<{ username: string }>
    }

    expect(latest.players.map((player) => player.username)).toEqual(["mika"])
  })
})
