import { describe, expect, it } from "vitest"
import { createLobby } from "./create-lobby"
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
    socket.listeners.get("message")?.(JSON.stringify({ type: "startGame" }))
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

  it("relays player destruction to other players", () => {
    const lobby = createLobby()
    const first = createSocket()
    const second = createSocket()

    lobby.addClient(first as never)
    lobby.addClient(second as never)

    first.listeners.get("message")?.(JSON.stringify({ type: "joinLobby", username: "mike" }))
    second.listeners.get("message")?.(JSON.stringify({ type: "joinLobby", username: "zoe" }))
    first.listeners.get("message")?.(JSON.stringify({ type: "startGame" }))
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
    socket.listeners.get("message")?.(JSON.stringify({ type: "startGame" }))

    const firstAsteroidState = socket.sent
      .map((message) => JSON.parse(message) as { type: string; asteroids?: Array<{ id: string }> })
      .find((message) => message.type === "asteroidState")
    const asteroid = firstAsteroidState?.asteroids?.[0]

    expect(asteroid?.id).toBe("asteroid-1")

    socket.listeners.get("message")?.(JSON.stringify({ type: "asteroidHit", asteroidId: asteroid?.id }))
    socket.listeners.get("message")?.(playerHitMessage)
    socket.listeners.get("message")?.(playerHitMessage)
    socket.listeners.get("message")?.(playerHitMessage)
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
        maxShipSpeed: 2400
      }
    }))
    host.listeners.get("message")?.(JSON.stringify({
      type: "setRoomSettings",
      settings: {
        mapSize: "tiny",
        asteroidDensity: 0,
        playerLives: 1,
        friendlyFire: true,
        maxShipSpeed: 800
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
        }
      })
      .filter((message) => message.type === "lobbyState")
      .at(-1)

    expect(latest?.settings).toEqual({
      mapSize: "tiny",
      asteroidDensity: 0,
      playerLives: 1,
      friendlyFire: true,
      maxShipSpeed: 800
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
    socket.listeners.get("message")?.(JSON.stringify({ type: "startGame" }))
    socket.listeners.get("message")?.(playerHitMessage)

    const gameOver = socket.sent
      .map((message) => JSON.parse(message) as { type: string })
      .find((message) => message.type === "gameOver")

    expect(gameOver?.type).toBe("gameOver")
    lobby.stop()
  })
})
