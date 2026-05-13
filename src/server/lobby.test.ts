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

    const latest = first.sent
      .map((message) => JSON.parse(message) as { type: string; players?: Array<{ username: string }> })
      .filter((message) => message.type === "lobbyState")
      .at(-1)

    expect(latest?.players?.map((player) => player.username)).toEqual(["mike", "zoe"])
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

    const firstStarted = first.sent
      .map((message) => JSON.parse(message) as { type: string })
      .find((message) => message.type === "gameStarted")
    const secondStarted = second.sent
      .map((message) => JSON.parse(message) as { type: string })
      .find((message) => message.type === "gameStarted")

    expect(firstStarted?.type).toBe("gameStarted")
    expect(secondStarted?.type).toBe("gameStarted")
    lobby.stop()
  })

  it("credits asteroid hits to the reporting player", () => {
    const lobby = createLobby()
    const first = createSocket()
    const second = createSocket()

    lobby.addClient(first as never)
    lobby.addClient(second as never)

    first.listeners.get("message")?.(JSON.stringify({ type: "joinLobby", username: "mike" }))
    second.listeners.get("message")?.(JSON.stringify({ type: "joinLobby", username: "zoe" }))
    first.listeners.get("message")?.(JSON.stringify({ type: "startGame" }))

    const asteroidState = first.sent
      .map((message) => JSON.parse(message) as { type: string; asteroids?: Array<{ id: string; size: string }> })
      .find((message) => message.type === "asteroidState")
    const asteroid = asteroidState?.asteroids?.[0]

    expect(asteroid).toBeDefined()

    first.listeners.get("message")?.(JSON.stringify({ type: "asteroidHit", asteroidId: asteroid?.id }))

    const scoreState = first.sent
      .map((message) => JSON.parse(message) as { type: string; scores?: { teamScore: number; players: Array<{ username: string; score: number }> } })
      .filter((message) => message.type === "scoreState")
      .at(-1)

    expect(scoreState?.scores?.teamScore).toBe(100)
    expect(scoreState?.scores?.players).toEqual([
      expect.objectContaining({ username: "mike", score: 100 }),
      expect.objectContaining({ username: "zoe", score: 0 })
    ])
    lobby.stop()
  })

  it("ends the game after every player loses all lives", () => {
    const lobby = createLobby()
    const socket = createSocket()

    lobby.addClient(socket as never)

    socket.listeners.get("message")?.(JSON.stringify({ type: "joinLobby", username: "mike" }))
    socket.listeners.get("message")?.(JSON.stringify({ type: "startGame" }))
    socket.listeners.get("message")?.(JSON.stringify({ type: "playerHit" }))
    socket.listeners.get("message")?.(JSON.stringify({ type: "playerHit" }))
    socket.listeners.get("message")?.(JSON.stringify({ type: "playerHit" }))

    const messages = socket.sent.map((message) => JSON.parse(message) as { type: string; lives?: { players: Array<{ lives: number; isEliminated: boolean }> } })
    const latestLifeState = messages.filter((message) => message.type === "lifeState").at(-1)
    const gameOver = messages.find((message) => message.type === "gameOver")

    expect(latestLifeState?.lives?.players[0]).toEqual(
      expect.objectContaining({
        lives: 0,
        isEliminated: true
      })
    )
    expect(gameOver?.type).toBe("gameOver")
    lobby.stop()
  })

  it("relays fired projectiles to other players", () => {
    const lobby = createLobby()
    const first = createSocket()
    const second = createSocket()

    lobby.addClient(first as never)
    lobby.addClient(second as never)

    first.listeners.get("message")?.(JSON.stringify({ type: "joinLobby", username: "mike" }))
    second.listeners.get("message")?.(JSON.stringify({ type: "joinLobby", username: "zoe" }))
    first.listeners.get("message")?.(JSON.stringify({ type: "startGame" }))
    first.listeners.get("message")?.(JSON.stringify({
      type: "projectileFired",
      projectile: {
        id: "mike-1",
        owner: "mike",
        color: "#74ffe0",
        position: { x: 10, y: 12 },
        velocity: { x: 100, y: 0 },
        ttlSeconds: 1.8
      }
    }))

    const relayedToFirst = first.sent
      .map((message) => JSON.parse(message) as { type: string; projectile?: { id: string } })
      .find((message) => message.type === "projectileFired")
    const relayedToSecond = second.sent
      .map((message) => JSON.parse(message) as { type: string; projectile?: { id: string } })
      .find((message) => message.type === "projectileFired")

    expect(relayedToFirst).toBeUndefined()
    expect(relayedToSecond?.projectile?.id).toBe("mike-1")
    lobby.stop()
  })

  it("broadcasts custom asteroid names and labels spawned asteroids", () => {
    const lobby = createLobby()
    const socket = createSocket()

    lobby.addClient(socket as never)

    socket.listeners.get("message")?.(JSON.stringify({ type: "joinLobby", username: "mike" }))
    socket.listeners.get("message")?.(JSON.stringify({
      type: "setAsteroidNames",
      asteroidNames: {
        extraLarge: ["Mega Mabel"],
        large: ["Larry"],
        medium: ["Miriam"],
        small: ["Sally"]
      }
    }))
    socket.listeners.get("message")?.(JSON.stringify({ type: "startGame" }))

    const lobbyState = socket.sent
      .map((message) => JSON.parse(message) as { type: string; asteroidNames?: { large: string[] } })
      .filter((message) => message.type === "lobbyState")
      .at(-1)
    const asteroidState = socket.sent
      .map((message) => JSON.parse(message) as { type: string; asteroids?: Array<{ size: string; name?: string }> })
      .find((message) => message.type === "asteroidState")

    expect(lobbyState?.asteroidNames?.large).toEqual(["Larry"])
    expect(asteroidState?.asteroids?.every((asteroid) => typeof asteroid.name === "string" && asteroid.name.length > 0)).toBe(true)
    lobby.stop()
  })

  it("includes destroyed asteroid name counts in the game over payload", () => {
    const lobby = createLobby()
    const socket = createSocket()

    lobby.addClient(socket as never)

    socket.listeners.get("message")?.(JSON.stringify({ type: "joinLobby", username: "mike" }))
    socket.listeners.get("message")?.(JSON.stringify({
      type: "setAsteroidNames",
      asteroidNames: {
        extraLarge: ["Mega Mabel"],
        large: ["Larry"],
        medium: ["Miriam"],
        small: ["Sally"]
      }
    }))
    socket.listeners.get("message")?.(JSON.stringify({ type: "startGame" }))

    const asteroidState = socket.sent
      .map((message) => JSON.parse(message) as { type: string; asteroids?: Array<{ id: string; name: string; size: "extraLarge" | "large" | "medium" | "small" }> })
      .find((message) => message.type === "asteroidState")
    const asteroid = asteroidState?.asteroids?.[0]

    expect(asteroid).toBeDefined()

    socket.listeners.get("message")?.(JSON.stringify({ type: "asteroidHit", asteroidId: asteroid?.id }))
    socket.listeners.get("message")?.(JSON.stringify({ type: "playerHit" }))
    socket.listeners.get("message")?.(JSON.stringify({ type: "playerHit" }))
    socket.listeners.get("message")?.(JSON.stringify({ type: "playerHit" }))

    const gameOver = socket.sent
      .map((message) => JSON.parse(message) as {
        type: string
        asteroidStats?: {
          players: Array<{
            username: string
            destroyedBySize: Record<string, number>
            destroyedNamesBySize: Record<string, Record<string, number>>
          }>
        }
      })
      .find((message) => message.type === "gameOver")
    const stats = gameOver?.asteroidStats?.players.find((player) => player.username === "mike")

    expect(stats?.destroyedBySize[asteroid?.size ?? "large"]).toBe(1)
    expect(stats?.destroyedNamesBySize[asteroid?.size ?? "large"][asteroid?.name ?? ""]).toBe(1)
    lobby.stop()
  })

  it("resets asteroids and spawn scaling when starting a new game", () => {
    const lobby = createLobby()
    const socket = createSocket()

    lobby.addClient(socket as never)

    socket.listeners.get("message")?.(JSON.stringify({ type: "joinLobby", username: "mike" }))
    socket.listeners.get("message")?.(JSON.stringify({ type: "startGame" }))

    const firstAsteroidState = socket.sent
      .map((message) => JSON.parse(message) as { type: string; asteroids?: Array<{ id: string }> })
      .find((message) => message.type === "asteroidState")
    const asteroid = firstAsteroidState?.asteroids?.[0]

    expect(asteroid?.id).toBe("asteroid-1")

    socket.listeners.get("message")?.(JSON.stringify({ type: "asteroidHit", asteroidId: asteroid?.id }))
    socket.listeners.get("message")?.(JSON.stringify({ type: "playerHit" }))
    socket.listeners.get("message")?.(JSON.stringify({ type: "playerHit" }))
    socket.listeners.get("message")?.(JSON.stringify({ type: "playerHit" }))
    socket.listeners.get("message")?.(JSON.stringify({ type: "startGame" }))

    const secondAsteroidState = socket.sent
      .map((message) => JSON.parse(message) as { type: string; asteroids?: Array<{ id: string }> })
      .filter((message) => message.type === "asteroidState")
      .at(-1)

    expect(secondAsteroidState?.asteroids?.[0]?.id).toBe("asteroid-1")
    expect(secondAsteroidState?.asteroids?.length).toBe(firstAsteroidState?.asteroids?.length)
    lobby.stop()
  })

  it("updates usernames but ignores blank rename attempts", () => {
    const lobby = createLobby()
    const socket = createSocket()

    lobby.addClient(socket as never)

    socket.listeners.get("message")?.(JSON.stringify({ type: "joinLobby", username: "mike" }))
    socket.listeners.get("message")?.(JSON.stringify({ type: "joinLobby", username: "mika" }))
    socket.listeners.get("message")?.(JSON.stringify({ type: "joinLobby", username: "   " }))

    const latest = socket.sent
      .map((message) => JSON.parse(message) as { type: string; players?: Array<{ username: string }> })
      .filter((message) => message.type === "lobbyState")
      .at(-1)

    expect(latest?.players?.map((player) => player.username)).toEqual(["mika"])
  })
})
