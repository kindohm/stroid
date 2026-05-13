import { randomUUID } from "node:crypto"
import type { WebSocket } from "ws"
import { assignPlayerColor } from "../game/assign-player-color"
import { createBorderAsteroid } from "../game/create-border-asteroid"
import { getAsteroidSpawnTarget } from "../game/get-asteroid-spawn-target"
import { getAsteroidSpeedMultiplier } from "../game/get-asteroid-speed-multiplier"
import { splitAsteroid } from "../game/split-asteroid"
import { updateAsteroids } from "../game/update-asteroids"
import { gameConfig } from "../shared/game-config"
import type { Asteroid, GameWorld } from "../shared/game-types"
import type { ClientLobbyMessage, LobbyPlayer, ServerLobbyMessage } from "../shared/lobby-types"

type LobbyClient = {
  id: string
  socket: WebSocket
  username?: string
}

const sanitizeUsername = (username: string) => username.trim().slice(0, 18)
const world: GameWorld = {
  width: gameConfig.mapTilesWide * gameConfig.tileSize,
  height: gameConfig.mapTilesTall * gameConfig.tileSize
}

const parseClientMessage = (data: WebSocket.RawData): ClientLobbyMessage | undefined => {
  try {
    const message = JSON.parse(data.toString()) as Partial<ClientLobbyMessage>

    if (message.type === "startGame") {
      return {
        type: "startGame"
      }
    }

    if (message.type === "playerState" && typeof message.ship === "object" && message.ship) {
      return {
        type: "playerState",
        ship: message.ship
      } as ClientLobbyMessage
    }

    if (message.type === "asteroidHit" && typeof message.asteroidId === "string") {
      return {
        type: "asteroidHit",
        asteroidId: message.asteroidId
      }
    }

    if (message.type === "joinLobby" && typeof message.username === "string") {
      return {
        type: "joinLobby",
        username: sanitizeUsername(message.username)
      }
    }

    return undefined
  } catch {
    return undefined
  }
}

export const createLobby = () => {
  const clients = new Map<string, LobbyClient>()
  let asteroids: Asteroid[] = []
  let asteroidsSpawned = 0
  let asteroidsDestroyed = 0
  let asteroidId = 0
  let asteroidInterval: ReturnType<typeof setInterval> | undefined
  let lastAsteroidTick = Date.now()

  const createAsteroidId = () => {
    asteroidId += 1
    return `asteroid-${asteroidId}`
  }

  const createAsteroid = () => {
    const speedMultiplier = getAsteroidSpeedMultiplier(asteroidsSpawned, asteroidsDestroyed)
    asteroidsSpawned += 1
    return createBorderAsteroid(createAsteroidId(), world, Math.random, speedMultiplier)
  }

  const fillAsteroidTarget = () => {
    const target = getAsteroidSpawnTarget(asteroidsSpawned, asteroidsDestroyed)

    while (asteroids.length < target) {
      asteroids = [...asteroids, createAsteroid()]
    }
  }

  const getPlayers = (): LobbyPlayer[] =>
    [...clients.values()]
      .filter((client) => typeof client.username === "string" && client.username.length > 0)
      .map((client) => ({
        id: client.id,
        username: client.username ?? "",
        color: assignPlayerColor(client.username ?? "")
      }))

  const sendLobbyState = (client: LobbyClient) => {
    const message: ServerLobbyMessage = {
      type: "lobbyState",
      selfId: client.id,
      players: getPlayers()
    }

    client.socket.send(JSON.stringify(message))
  }

  const broadcastLobbyState = () => {
    clients.forEach(sendLobbyState)
  }

  const broadcastAsteroidState = () => {
    const message: ServerLobbyMessage = {
      type: "asteroidState",
      asteroids
    }

    clients.forEach((client) => {
      if (client.username) {
        client.socket.send(JSON.stringify(message))
      }
    })
  }

  const startAsteroids = () => {
    fillAsteroidTarget()
    broadcastAsteroidState()

    if (asteroidInterval) {
      return
    }

    lastAsteroidTick = Date.now()
    asteroidInterval = setInterval(() => {
      const now = Date.now()
      const deltaSeconds = Math.min(0.1, (now - lastAsteroidTick) / 1000)
      lastAsteroidTick = now
      asteroids = updateAsteroids(asteroids, deltaSeconds, world)
      fillAsteroidTarget()
      broadcastAsteroidState()
    }, gameConfig.asteroidStateBroadcastIntervalMs)
  }

  const stopAsteroids = () => {
    if (asteroidInterval) {
      clearInterval(asteroidInterval)
      asteroidInterval = undefined
    }
  }

  const sendGameStarted = (client: LobbyClient) => {
    if (!client.username) {
      return
    }

    const message: ServerLobbyMessage = {
      type: "gameStarted",
      selfId: client.id,
      players: getPlayers()
    }

    client.socket.send(JSON.stringify(message))
  }

  const broadcastGameStarted = () => {
    startAsteroids()
    clients.forEach(sendGameStarted)
  }

  const handleAsteroidHit = (asteroidIdToHit: string) => {
    const asteroid = asteroids.find((nextAsteroid) => nextAsteroid.id === asteroidIdToHit)

    if (!asteroid) {
      return
    }

    asteroids = asteroids.filter((nextAsteroid) => nextAsteroid.id !== asteroidIdToHit)
    asteroidsDestroyed += 1
    const children = splitAsteroid(
      asteroid,
      createAsteroidId,
      Math.random,
      getAsteroidSpeedMultiplier(asteroidsSpawned, asteroidsDestroyed)
    )
    asteroidsSpawned += children.length
    asteroids = [...asteroids, ...children]
    fillAsteroidTarget()
    broadcastAsteroidState()
  }

  const broadcastPlayerState = (client: LobbyClient, ship: Extract<ClientLobbyMessage, { type: "playerState" }>["ship"]) => {
    const message: ServerLobbyMessage = {
      type: "playerState",
      playerId: client.id,
      ship
    }

    clients.forEach((nextClient) => {
      if (nextClient.id !== client.id && nextClient.username) {
        nextClient.socket.send(JSON.stringify(message))
      }
    })
  }

  const addClient = (socket: WebSocket) => {
    const client: LobbyClient = {
      id: randomUUID(),
      socket
    }

    clients.set(client.id, client)
    sendLobbyState(client)

    socket.on("message", (data) => {
      const message = parseClientMessage(data)

      if (!message) {
        return
      }

      if (message.type === "startGame") {
        if (client.username && getPlayers().length > 0) {
          broadcastGameStarted()
        }

        return
      }

      if (message.type === "playerState") {
        if (client.username) {
          broadcastPlayerState(client, message.ship)
        }

        return
      }

      if (message.type === "asteroidHit") {
        handleAsteroidHit(message.asteroidId)
        return
      }

      if (message.username.length > 0) {
        client.username = message.username
        broadcastLobbyState()
      }
    })

    socket.on("close", () => {
      clients.delete(client.id)
      broadcastLobbyState()
    })
  }

  return {
    addClient,
    getPlayers,
    stop: stopAsteroids
  }
}
