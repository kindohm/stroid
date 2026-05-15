import { afterEach, describe, expect, it, vi } from "vitest"
import { createLobby } from "./create-lobby/create-lobby"
import { createSocket } from "./create-socket-stub.test-helper"

const playerHitMessage = JSON.stringify({
  type: "playerHit",
  cause: "asteroid",
  ship: {
    position: { x: 120, y: 140 },
    velocity: { x: 1, y: 2 },
    angle: 0.5,
    isThrusting: false
  }
})
const readyMessage = JSON.stringify({
  type: "setReady",
  isReady: true
})

const setReady = (socket: ReturnType<typeof createSocket>) => {
  socket.listeners.get("message")?.(readyMessage)
}

const startReadyGame = (host: ReturnType<typeof createSocket>, players: ReturnType<typeof createSocket>[] = []) => {
  [host, ...players].forEach(setReady)
  host.listeners.get("message")?.(JSON.stringify({ type: "startGame" }))
}

describe("createLobby", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

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
    startReadyGame(first, [second])

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

  it("requires every joined player to be ready before starting", () => {
    const lobby = createLobby()
    const first = createSocket()
    const second = createSocket()

    lobby.addClient(first as never)
    lobby.addClient(second as never)

    first.listeners.get("message")?.(JSON.stringify({ type: "joinLobby", username: "mike" }))
    second.listeners.get("message")?.(JSON.stringify({ type: "joinLobby", username: "zoe" }))
    setReady(first)
    first.listeners.get("message")?.(JSON.stringify({ type: "startGame" }))

    const earlyStart = first.sent
      .map((message) => JSON.parse(message) as { type: string })
      .find((message) => message.type === "gameStarted")

    expect(earlyStart).toBeUndefined()

    setReady(second)
    first.listeners.get("message")?.(JSON.stringify({ type: "startGame" }))

    const started = first.sent
      .map((message) => JSON.parse(message) as { type: string })
      .find((message) => message.type === "gameStarted")

    expect(started?.type).toBe("gameStarted")
    lobby.stop()
  })

  it("broadcasts player ready state in lobby state", () => {
    const lobby = createLobby()
    const first = createSocket()
    const second = createSocket()

    lobby.addClient(first as never)
    lobby.addClient(second as never)

    first.listeners.get("message")?.(JSON.stringify({ type: "joinLobby", username: "mike" }))
    second.listeners.get("message")?.(JSON.stringify({ type: "joinLobby", username: "zoe" }))
    setReady(second)

    const latest = first.sent
      .map((message) => JSON.parse(message) as {
        type: string
        players?: Array<{ username: string; isReady: boolean }>
      })
      .filter((message) => message.type === "lobbyState")
      .at(-1)

    expect(latest?.players).toEqual([
      expect.objectContaining({ username: "mike", isReady: false }),
      expect.objectContaining({ username: "zoe", isReady: true })
    ])
  })

  it("lets late joins spectate without entering score state", () => {
    const lobby = createLobby()
    const host = createSocket()
    const spectator = createSocket()

    lobby.addClient(host as never)
    host.listeners.get("message")?.(JSON.stringify({ type: "joinLobby", username: "mike" }))
    startReadyGame(host)
    lobby.addClient(spectator as never)
    spectator.listeners.get("message")?.(JSON.stringify({ type: "joinLobby", username: "kim" }))

    const spectatorStart = spectator.sent
      .map((message) => JSON.parse(message) as {
        type: string
        isSpectator?: boolean
        players?: Array<{ username: string }>
      })
      .find((message) => message.type === "gameStarted")
    const spectatorScore = spectator.sent
      .map((message) => JSON.parse(message) as {
        type: string
        scores?: { players: Array<{ username: string }> }
      })
      .filter((message) => message.type === "scoreState")
      .at(-1)

    expect(spectatorStart).toEqual(expect.objectContaining({
      isSpectator: true,
      players: [
        expect.objectContaining({ username: "mike" })
      ]
    }))
    expect(spectatorScore?.scores?.players.map((player) => player.username)).toEqual(["mike"])
    lobby.stop()
  })

  it("ignores spectator game actions", () => {
    const lobby = createLobby()
    const host = createSocket()
    const spectator = createSocket()

    lobby.addClient(host as never)
    host.listeners.get("message")?.(JSON.stringify({ type: "joinLobby", username: "mike" }))
    startReadyGame(host)
    lobby.addClient(spectator as never)
    spectator.listeners.get("message")?.(JSON.stringify({ type: "joinLobby", username: "kim" }))

    const asteroidState = host.sent
      .map((message) => JSON.parse(message) as {
        type: string
        asteroids?: Array<{ id: string }>
      })
      .find((message) => message.type === "asteroidState")
    const asteroid = asteroidState?.asteroids?.[0]

    expect(asteroid).toBeDefined()

    spectator.listeners.get("message")?.(JSON.stringify({ type: "asteroidHit", asteroidId: asteroid?.id }))

    const latestScore = host.sent
      .map((message) => JSON.parse(message) as {
        type: string
        scores?: { teamScore: number }
      })
      .filter((message) => message.type === "scoreState")
      .at(-1)

    expect(latestScore?.scores?.teamScore).toBe(0)
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
    startReadyGame(first, [second])

    const asteroidState = first.sent
      .map((message) => JSON.parse(message) as {
        type: string
        asteroids?: Array<{ id: string; size: string; position: { x: number } }>
      })
      .find((message) => message.type === "asteroidState")
    const asteroid = asteroidState?.asteroids?.[0]

    expect(asteroid).toBeDefined()

    first.listeners.get("message")?.(JSON.stringify({ type: "asteroidHit", asteroidId: asteroid?.id }))

    const destroyedState = first.sent
      .map((message) => JSON.parse(message) as { type: string; asteroid?: { id: string; position: { x: number } } })
      .find((message) => message.type === "asteroidDestroyed")
    const destroyedStateForSecond = second.sent
      .map((message) => JSON.parse(message) as { type: string; asteroid?: { id: string } })
      .find((message) => message.type === "asteroidDestroyed")
    const scoreState = first.sent
      .map((message) => JSON.parse(message) as {
        type: string
        scores?: { teamScore: number; players: Array<{ username: string; score: number }> }
      })
      .filter((message) => message.type === "scoreState")
      .at(-1)

    expect(destroyedState?.asteroid?.id).toBe(asteroid?.id)
    expect(destroyedState?.asteroid?.position.x).toBe(asteroid?.position?.x)
    expect(destroyedStateForSecond?.asteroid?.id).toBe(asteroid?.id)
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
    startReadyGame(socket)
    socket.listeners.get("message")?.(playerHitMessage)
    socket.listeners.get("message")?.(playerHitMessage)
    socket.listeners.get("message")?.(playerHitMessage)

    const messages = socket.sent.map((message) => JSON.parse(message) as {
      type: string
      lives?: { players: Array<{ lives: number; isEliminated: boolean }> }
      recap?: {
        highlights: {
          firstPlayerHit?: { type: string; cause: string }
          finalTenSeconds: Array<{ type: string }>
        }
      }
    })
    const latestLifeState = messages.filter((message) => message.type === "lifeState").at(-1)
    const gameOver = messages.find((message) => message.type === "gameOver")

    expect(latestLifeState?.lives?.players[0]).toEqual(
      expect.objectContaining({
        lives: 0,
        isEliminated: true
      })
    )
    expect(gameOver?.type).toBe("gameOver")
    expect(gameOver?.recap?.highlights.firstPlayerHit).toEqual(expect.objectContaining({
      type: "playerDestroyed",
      cause: "asteroid"
    }))
    expect(gameOver?.recap?.highlights.finalTenSeconds.at(-1)).toEqual(expect.objectContaining({
      type: "gameOver"
    }))
    lobby.stop()
  })

  it("creates a ghost marker when a player is eliminated and revives them with one life", () => {
    const lobby = createLobby()
    const first = createSocket()
    const second = createSocket()

    lobby.addClient(first as never)
    lobby.addClient(second as never)

    first.listeners.get("message")?.(JSON.stringify({ type: "joinLobby", username: "mike" }))
    second.listeners.get("message")?.(JSON.stringify({ type: "joinLobby", username: "zoe" }))
    startReadyGame(first, [second])
    first.listeners.get("message")?.(playerHitMessage)
    first.listeners.get("message")?.(playerHitMessage)
    first.listeners.get("message")?.(playerHitMessage)

    const eliminatedLifeState = first.sent
      .map((message) => JSON.parse(message) as {
        type: string
        lives?: {
          players: Array<{
            id: string
            username: string
            lives: number
            isEliminated: boolean
            ghostPosition?: { x: number; y: number }
          }>
        }
      })
      .filter((message) => message.type === "lifeState")
      .at(-1)

    expect(eliminatedLifeState?.lives?.players.find((player) => player.username === "mike")).toEqual(
      expect.objectContaining({
        lives: 0,
        isEliminated: true,
        ghostPosition: { x: 120, y: 140 }
      })
    )

    const eliminatedPlayerId = eliminatedLifeState?.lives?.players.find((player) => player.username === "mike")?.id

    second.listeners.get("message")?.(JSON.stringify({ type: "revivePlayer", playerId: eliminatedPlayerId }))

    const revivedLifeState = first.sent
      .map((message) => JSON.parse(message) as {
        type: string
        lives?: {
          players: Array<{
            username: string
            lives: number
            isEliminated: boolean
            ghostPosition?: { x: number; y: number }
          }>
        }
      })
      .filter((message) => message.type === "lifeState")
      .at(-1)

    const revivedPlayer = revivedLifeState?.lives?.players.find((player) => player.username === "mike")

    expect(revivedPlayer).toEqual(
      expect.objectContaining({
        lives: 1,
        isEliminated: false
      })
    )
    expect(revivedPlayer).not.toHaveProperty("ghostPosition")
    lobby.stop()
  })

  it("does not let players revive themselves", () => {
    const lobby = createLobby()
    const first = createSocket()
    const second = createSocket()

    lobby.addClient(first as never)
    lobby.addClient(second as never)

    first.listeners.get("message")?.(JSON.stringify({ type: "joinLobby", username: "mike" }))
    second.listeners.get("message")?.(JSON.stringify({ type: "joinLobby", username: "zoe" }))
    startReadyGame(first, [second])
    first.listeners.get("message")?.(playerHitMessage)
    first.listeners.get("message")?.(playerHitMessage)
    first.listeners.get("message")?.(playerHitMessage)

    const eliminatedLifeState = first.sent
      .map((message) => JSON.parse(message) as {
        type: string
        lives?: {
          players: Array<{
            id: string
            username: string
          }>
        }
      })
      .filter((message) => message.type === "lifeState")
      .at(-1)
    const eliminatedPlayerId = eliminatedLifeState?.lives?.players.find((player) => player.username === "mike")?.id

    first.listeners.get("message")?.(JSON.stringify({ type: "revivePlayer", playerId: eliminatedPlayerId }))

    const latestLifeState = first.sent
      .map((message) => JSON.parse(message) as {
        type: string
        lives?: {
          players: Array<{
            username: string
            lives: number
            isEliminated: boolean
          }>
        }
      })
      .filter((message) => message.type === "lifeState")
      .at(-1)

    expect(latestLifeState?.lives?.players.find((player) => player.username === "mike")).toEqual(
      expect.objectContaining({
        lives: 0,
        isEliminated: true
      })
    )
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
    startReadyGame(first, [second])
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

  it("relays player destruction to other players", () => {
    const lobby = createLobby()
    const first = createSocket()
    const second = createSocket()

    lobby.addClient(first as never)
    lobby.addClient(second as never)

    first.listeners.get("message")?.(JSON.stringify({ type: "joinLobby", username: "mike" }))
    second.listeners.get("message")?.(JSON.stringify({ type: "joinLobby", username: "zoe" }))
    startReadyGame(first, [second])
    first.listeners.get("message")?.(playerHitMessage)

    const relayedToFirst = first.sent
      .map((message) => JSON.parse(message) as { type: string })
      .find((message) => message.type === "playerDestroyed")
    const relayedToSecond = second.sent
      .map((message) => JSON.parse(message) as { type: string; playerId?: string; ship?: { position: { x: number } } })
      .find((message) => message.type === "playerDestroyed")

    expect(relayedToFirst).toBeUndefined()
    expect(relayedToSecond?.playerId).toBeDefined()
    expect(relayedToSecond?.ship?.position.x).toBe(120)
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
    startReadyGame(socket)

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

  it("uses asteroid names from the first joined player", () => {
    const lobby = createLobby()
    const first = createSocket()
    const second = createSocket()

    lobby.addClient(first as never)
    lobby.addClient(second as never)

    first.listeners.get("message")?.(JSON.stringify({
      type: "joinLobby",
      username: "mike",
      asteroidNames: {
        extraLarge: ["First XL"],
        large: ["First Large"],
        medium: ["First Medium"],
        small: ["First Small"]
      }
    }))
    second.listeners.get("message")?.(JSON.stringify({
      type: "joinLobby",
      username: "zoe",
      asteroidNames: {
        extraLarge: ["Second XL"],
        large: ["Second Large"],
        medium: ["Second Medium"],
        small: ["Second Small"]
      }
    }))

    const latest = first.sent
      .map((message) => JSON.parse(message) as { type: string; asteroidNames?: { large: string[] } })
      .filter((message) => message.type === "lobbyState")
      .at(-1)

    expect(latest?.asteroidNames?.large).toEqual(["First Large"])
  })

  it("ignores asteroid name updates from clients before they join", () => {
    const lobby = createLobby()
    const first = createSocket()
    const second = createSocket()

    lobby.addClient(first as never)
    lobby.addClient(second as never)

    second.listeners.get("message")?.(JSON.stringify({
      type: "setAsteroidNames",
      asteroidNames: {
        extraLarge: ["Sneaky XL"],
        large: ["Sneaky Large"],
        medium: ["Sneaky Medium"],
        small: ["Sneaky Small"]
      }
    }))
    first.listeners.get("message")?.(JSON.stringify({
      type: "joinLobby",
      username: "mike",
      asteroidNames: {
        extraLarge: ["First XL"],
        large: ["First Large"],
        medium: ["First Medium"],
        small: ["First Small"]
      }
    }))

    const latest = first.sent
      .map((message) => JSON.parse(message) as { type: string; asteroidNames?: { large: string[] } })
      .filter((message) => message.type === "lobbyState")
      .at(-1)

    expect(latest?.asteroidNames?.large).toEqual(["First Large"])
  })

  it("only lets the host update asteroid names", () => {
    const lobby = createLobby()
    const host = createSocket()
    const guest = createSocket()

    lobby.addClient(host as never)
    lobby.addClient(guest as never)

    host.listeners.get("message")?.(JSON.stringify({ type: "joinLobby", username: "mike" }))
    guest.listeners.get("message")?.(JSON.stringify({ type: "joinLobby", username: "zoe" }))
    guest.listeners.get("message")?.(JSON.stringify({
      type: "setAsteroidNames",
      asteroidNames: {
        extraLarge: ["Guest XL"],
        large: ["Guest Large"],
        medium: ["Guest Medium"],
        small: ["Guest Small"]
      }
    }))

    const afterGuestUpdate = host.sent
      .map((message) => JSON.parse(message) as { type: string; asteroidNames?: { large: string[] } })
      .filter((message) => message.type === "lobbyState")
      .at(-1)

    expect(afterGuestUpdate?.asteroidNames?.large).not.toEqual(["Guest Large"])

    host.listeners.get("message")?.(JSON.stringify({
      type: "setAsteroidNames",
      asteroidNames: {
        extraLarge: ["Host XL"],
        large: ["Host Large"],
        medium: ["Host Medium"],
        small: ["Host Small"]
      }
    }))

    const afterHostUpdate = host.sent
      .map((message) => JSON.parse(message) as { type: string; asteroidNames?: { large: string[] } })
      .filter((message) => message.type === "lobbyState")
      .at(-1)

    expect(afterHostUpdate?.asteroidNames?.large).toEqual(["Host Large"])
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
    startReadyGame(socket)

    const asteroidState = socket.sent
      .map((message) => JSON.parse(message) as {
        type: string
        asteroids?: Array<{ id: string; name: string; size: "extraLarge" | "large" | "medium" | "small" }>
      })
      .find((message) => message.type === "asteroidState")
    const asteroid = asteroidState?.asteroids?.[0]

    expect(asteroid).toBeDefined()

    socket.listeners.get("message")?.(JSON.stringify({ type: "asteroidHit", asteroidId: asteroid?.id }))
    socket.listeners.get("message")?.(playerHitMessage)
    socket.listeners.get("message")?.(playerHitMessage)
    socket.listeners.get("message")?.(playerHitMessage)

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
        recap?: {
          highlights: {
            finalAsteroidDestroyed?: { asteroidName: string }
            biggestScoreStreak?: { player: { username: string }; score: number; asteroidCount: number }
          }
        }
      })
      .find((message) => message.type === "gameOver")
    const stats = gameOver?.asteroidStats?.players.find((player) => player.username === "mike")

    expect(stats?.destroyedBySize[asteroid?.size ?? "large"]).toBe(1)
    expect(stats?.destroyedNamesBySize[asteroid?.size ?? "large"][asteroid?.name ?? ""]).toBe(1)
    expect(gameOver?.recap?.highlights.finalAsteroidDestroyed?.asteroidName).toBe(asteroid?.name)
    expect(gameOver?.recap?.highlights.biggestScoreStreak).toEqual(expect.objectContaining({
      score: 100,
      asteroidCount: 1
    }))
    lobby.stop()
  })

  it("resets asteroids and spawn scaling when starting a new game", () => {
    const lobby = createLobby()
    const socket = createSocket()

    lobby.addClient(socket as never)

    socket.listeners.get("message")?.(JSON.stringify({ type: "joinLobby", username: "mike" }))
    startReadyGame(socket)

    const firstAsteroidState = socket.sent
      .map((message) => JSON.parse(message) as { type: string; asteroids?: Array<{ id: string }> })
      .find((message) => message.type === "asteroidState")
    const asteroid = firstAsteroidState?.asteroids?.[0]

    expect(asteroid?.id).toBe("asteroid-1")

    socket.listeners.get("message")?.(JSON.stringify({ type: "asteroidHit", asteroidId: asteroid?.id }))
    socket.listeners.get("message")?.(playerHitMessage)
    socket.listeners.get("message")?.(playerHitMessage)
    socket.listeners.get("message")?.(playerHitMessage)
    startReadyGame(socket)

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

  it("only lets the host update room settings before the game starts", () => {
    const lobby = createLobby()
    const host = createSocket()
    const guest = createSocket()

    lobby.addClient(host as never)
    lobby.addClient(guest as never)

    host.listeners.get("message")?.(JSON.stringify({ type: "joinLobby", username: "mike" }))
    guest.listeners.get("message")?.(JSON.stringify({ type: "joinLobby", username: "zoe" }))
    guest.listeners.get("message")?.(JSON.stringify({
      type: "setRoomSettings",
      settings: {
        mapSize: "huge",
        asteroidDensity: 1,
        playerLives: 9,
        friendlyFire: true,
        maxShipSpeed: 2400,
        bossIntervalMinutes: 3,
        bossHealthPerPlayer: 40
      }
    }))
    host.listeners.get("message")?.(JSON.stringify({
      type: "setRoomSettings",
      settings: {
        mapSize: "tiny",
        asteroidDensity: 0,
        playerLives: 1,
        friendlyFire: true,
        maxShipSpeed: 800,
        bossIntervalMinutes: 2,
        bossHealthPerPlayer: 35
      }
    }))

    const latest = guest.sent
      .map((message) => JSON.parse(message) as {
        type: string
        settings?: {
          mapSize: string
          asteroidDensity: number
          playerLives: number
          friendlyFire: boolean
          maxShipSpeed: number
          bossIntervalMinutes: number
          bossHealthPerPlayer: number
        }
      })
      .filter((message) => message.type === "lobbyState")
      .at(-1)

    expect(latest?.settings).toEqual({
      mapSize: "tiny",
      asteroidDensity: 0,
      playerLives: 1,
      friendlyFire: true,
      maxShipSpeed: 800,
      bossIntervalMinutes: 2,
      bossHealthPerPlayer: 35
    })
  })

  it("uses room settings for starting lives", () => {
    const lobby = createLobby()
    const socket = createSocket()

    lobby.addClient(socket as never)

    socket.listeners.get("message")?.(JSON.stringify({ type: "joinLobby", username: "mike" }))
    socket.listeners.get("message")?.(JSON.stringify({
      type: "setRoomSettings",
      settings: {
        mapSize: "standard",
        asteroidDensity: 0.5,
        playerLives: 1,
        friendlyFire: false,
        maxShipSpeed: 1640
      }
    }))
    startReadyGame(socket)
    socket.listeners.get("message")?.(playerHitMessage)

    const gameOver = socket.sent
      .map((message) => JSON.parse(message) as { type: string })
      .find((message) => message.type === "gameOver")

    expect(gameOver?.type).toBe("gameOver")
    lobby.stop()
  })

  it("spawns, scores, and defeats a boss encounter after asteroids are cleared", () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)

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
        small: ["Sally"],
        boss: ["The Big One"]
      }
    }))
    socket.listeners.get("message")?.(JSON.stringify({
      type: "setRoomSettings",
      settings: {
        mapSize: "standard",
        asteroidDensity: 0,
        playerLives: 3,
        friendlyFire: false,
        maxShipSpeed: 1640,
        bossIntervalMinutes: 1,
        bossHealthPerPlayer: 5
      }
    }))
    startReadyGame(socket)

    vi.advanceTimersByTime(60_040)

    const preSpawnState = socket.sent
      .map((message) => JSON.parse(message) as { type: string; preSpawnActive?: boolean })
      .filter((message) => message.type === "bossState")
      .at(-1)

    expect(preSpawnState?.preSpawnActive).toBe(true)

    for (let guard = 0; guard < 20; guard += 1) {
      const asteroidState = socket.sent
        .map((message) => JSON.parse(message) as { type: string; asteroids?: Array<{ id: string }> })
        .filter((message) => message.type === "asteroidState")
        .at(-1)
      const asteroid = asteroidState?.asteroids?.[0]

      if (!asteroid) {
        break
      }

      socket.listeners.get("message")?.(JSON.stringify({ type: "asteroidHit", asteroidId: asteroid.id }))
    }

    vi.advanceTimersByTime(40)

    const bossState = socket.sent
      .map((message) => JSON.parse(message) as {
        type: string
        boss?: { id: string; name: string; health: number; maxHealth: number; radius: number }
      })
      .filter((message) => message.type === "bossState" && message.boss)
      .at(-1)

    expect(bossState?.boss).toEqual(expect.objectContaining({
      name: "The Big One",
      health: 5,
      maxHealth: 5,
      radius: 210
    }))

    const scoreBeforeBoss = socket.sent
      .map((message) => JSON.parse(message) as {
        type: string
        scores?: { teamScore: number; players: Array<{ username: string; score: number }> }
      })
      .filter((message) => message.type === "scoreState")
      .at(-1)?.scores?.teamScore ?? 0

    for (let hit = 0; hit < 5; hit += 1) {
      socket.listeners.get("message")?.(JSON.stringify({ type: "bossHit", bossId: bossState?.boss?.id }))
    }

    const bossDefeated = socket.sent
      .map((message) => JSON.parse(message) as { type: string; boss?: { name: string } })
      .find((message) => message.type === "bossDefeated")
    const scoreState = socket.sent
      .map((message) => JSON.parse(message) as {
        type: string
        scores?: { teamScore: number; players: Array<{ username: string; score: number }> }
      })
      .filter((message) => message.type === "scoreState")
      .at(-1)
    const shardState = socket.sent
      .map((message) => JSON.parse(message) as { type: string; asteroids?: Array<{ size: string }> })
      .filter((message) => message.type === "asteroidState")
      .at(-1)

    expect(bossDefeated?.boss?.name).toBe("The Big One")
    expect(scoreState?.scores?.teamScore).toBe(scoreBeforeBoss + 750)
    expect(scoreState?.scores?.players[0]).toEqual(expect.objectContaining({
      username: "mike",
      score: scoreBeforeBoss + 750
    }))
    expect(shardState?.asteroids?.filter((asteroid) => asteroid.size === "large")).toHaveLength(3)
    lobby.stop()
  })
})
