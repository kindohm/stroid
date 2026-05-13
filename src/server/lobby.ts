import { randomUUID } from "node:crypto"
import type { WebSocket } from "ws"
import { assignPlayerColor } from "../game/assign-player-color"
import { createBorderAsteroid } from "../game/create-border-asteroid"
import { getAsteroidSpawnTarget } from "../game/get-asteroid-spawn-target"
import { getAsteroidSpeedMultiplier } from "../game/get-asteroid-speed-multiplier"
import { splitAsteroid } from "../game/split-asteroid"
import { updateAsteroids } from "../game/update-asteroids"
import { gameConfig } from "../shared/game-config"
import type { Asteroid, AsteroidSize, GameWorld, Projectile } from "../shared/game-types"
import type {
  AsteroidNamePools,
  AsteroidNameSize,
  AsteroidStatsState,
  ClientLobbyMessage,
  LifeState,
  LobbyPlayer,
  PlayerAsteroidStats,
  ScoreState,
  ServerLobbyMessage
} from "../shared/lobby-types"

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
const asteroidScoreBySize: Record<AsteroidSize, number> = {
  extraLarge: 100,
  large: 100,
  medium: 200,
  small: 300
}
const defaultAsteroidNames: AsteroidNamePools = {
  extraLarge: ["Worldbone", "Old Mountain", "The Big Oof"],
  large: ["Goliath", "Big Drift", "Hullbreaker"],
  medium: ["Nomad", "Basalt", "Cinder"],
  small: ["Pebble", "Spark", "Chip"]
}
const nameSizeByAsteroidSize: Record<AsteroidSize, AsteroidNameSize> = {
  extraLarge: "extraLarge",
  large: "large",
  medium: "medium",
  small: "small"
}
const sanitizeAsteroidNames = (value: unknown, fallback: AsteroidNamePools): AsteroidNamePools => {
  if (!value || typeof value !== "object") {
    return fallback
  }

  const source = value as Partial<Record<AsteroidNameSize, unknown>>
  const sanitizeList = (size: AsteroidNameSize) => {
    const names = Array.isArray(source[size]) ? source[size] : fallback[size]
    const sanitized = names
      .filter((name): name is string => typeof name === "string")
      .map((name) => name.trim().slice(0, 24))
      .filter((name) => name.length > 0)
      .slice(0, 12)

    return sanitized.length > 0 ? sanitized : fallback[size]
  }

  return {
    extraLarge: sanitizeList("extraLarge"),
    large: sanitizeList("large"),
    medium: sanitizeList("medium"),
    small: sanitizeList("small")
  }
}

const parseClientMessage = (data: WebSocket.RawData): ClientLobbyMessage | undefined => {
  try {
    const message = JSON.parse(data.toString()) as Partial<ClientLobbyMessage>

    if (message.type === "startGame") {
      return {
        type: "startGame"
      }
    }

    if (message.type === "setAsteroidNames") {
      return {
        type: "setAsteroidNames",
        asteroidNames: sanitizeAsteroidNames(message.asteroidNames, defaultAsteroidNames)
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

    if (message.type === "playerHit") {
      return {
        type: "playerHit"
      }
    }

    if (message.type === "projectileFired" && typeof message.projectile === "object" && message.projectile) {
      return {
        type: "projectileFired",
        projectile: message.projectile as Projectile
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
  const scoresByClientId = new Map<string, number>()
  const livesByClientId = new Map<string, number>()
  const asteroidStatsByClientId = new Map<string, PlayerAsteroidStats>()
  let asteroidNames = defaultAsteroidNames
  let gameInProgress = false
  let gameOver = false

  const createAsteroidId = () => {
    asteroidId += 1
    return `asteroid-${asteroidId}`
  }

  const nameAsteroid = (asteroid: Asteroid): Asteroid => {
    const names = asteroidNames[nameSizeByAsteroidSize[asteroid.size]]
    const name = names[Math.floor(Math.random() * names.length)]

    return {
      ...asteroid,
      name
    }
  }

  const createAsteroid = () => {
    const speedMultiplier = getAsteroidSpeedMultiplier(asteroidsSpawned, asteroidsDestroyed)
    asteroidsSpawned += 1
    return nameAsteroid(createBorderAsteroid(createAsteroidId(), world, Math.random, speedMultiplier))
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

  const getScoreState = (): ScoreState => {
    const players = getPlayers()
      .map((player) => ({
        ...player,
        score: scoresByClientId.get(player.id) ?? 0
      }))
      .sort((left, right) => right.score - left.score || left.username.localeCompare(right.username))

    return {
      teamScore: players.reduce((total, player) => total + player.score, 0),
      players
    }
  }

  const getLifeState = (): LifeState => ({
    players: getPlayers().map((player) => {
      const lives = livesByClientId.get(player.id) ?? gameConfig.playerStartingLives

      return {
        ...player,
        lives,
        isEliminated: lives <= 0
      }
    })
  })

  const createEmptyAsteroidStats = (player: LobbyPlayer): PlayerAsteroidStats => ({
    ...player,
    destroyedBySize: {
      extraLarge: 0,
      large: 0,
      medium: 0,
      small: 0
    },
    destroyedNamesBySize: {
      extraLarge: {},
      large: {},
      medium: {},
      small: {}
    }
  })

  const getAsteroidStatsState = (): AsteroidStatsState => ({
    players: getPlayers().map((player) => asteroidStatsByClientId.get(player.id) ?? createEmptyAsteroidStats(player))
  })

  const recordAsteroidDestroyed = (client: LobbyClient, asteroid: Asteroid) => {
    const player = getPlayers().find((nextPlayer) => nextPlayer.id === client.id)

    if (!player) {
      return
    }

    const size = nameSizeByAsteroidSize[asteroid.size]
    const stats = asteroidStatsByClientId.get(client.id) ?? createEmptyAsteroidStats(player)
    const name = asteroid.name ?? "unnamed"

    asteroidStatsByClientId.set(client.id, {
      ...stats,
      username: player.username,
      color: player.color,
      destroyedBySize: {
        ...stats.destroyedBySize,
        [size]: stats.destroyedBySize[size] + 1
      },
      destroyedNamesBySize: {
        ...stats.destroyedNamesBySize,
        [size]: {
          ...stats.destroyedNamesBySize[size],
          [name]: (stats.destroyedNamesBySize[size][name] ?? 0) + 1
        }
      }
    })
  }

  const sendLobbyState = (client: LobbyClient) => {
    const message: ServerLobbyMessage = {
      type: "lobbyState",
      selfId: client.id,
      players: getPlayers(),
      asteroidNames
    }

    client.socket.send(JSON.stringify(message))
  }

  const broadcastScoreState = () => {
    const message: ServerLobbyMessage = {
      type: "scoreState",
      scores: getScoreState()
    }

    clients.forEach((client) => {
      if (client.username) {
        client.socket.send(JSON.stringify(message))
      }
    })
  }

  const broadcastLifeState = () => {
    const message: ServerLobbyMessage = {
      type: "lifeState",
      lives: getLifeState()
    }

    clients.forEach((client) => {
      if (client.username) {
        client.socket.send(JSON.stringify(message))
      }
    })
  }

  const broadcastGameOver = () => {
    const message: ServerLobbyMessage = {
      type: "gameOver",
      scores: getScoreState(),
      lives: getLifeState(),
      asteroidStats: getAsteroidStatsState()
    }

    clients.forEach((client) => {
      if (client.username) {
        client.socket.send(JSON.stringify(message))
      }
    })
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

  const resetAsteroids = () => {
    stopAsteroids()
    asteroids = []
    asteroidsSpawned = 0
    asteroidsDestroyed = 0
    asteroidId = 0
    lastAsteroidTick = Date.now()
  }

  const sendGameStarted = (client: LobbyClient) => {
    if (!client.username) {
      return
    }

    const message: ServerLobbyMessage = {
      type: "gameStarted",
      selfId: client.id,
      players: getPlayers(),
      asteroidNames
    }

    client.socket.send(JSON.stringify(message))
  }

  const broadcastGameStarted = () => {
    scoresByClientId.clear()
    livesByClientId.clear()
    asteroidStatsByClientId.clear()
    getPlayers().forEach((player) => {
      livesByClientId.set(player.id, gameConfig.playerStartingLives)
      asteroidStatsByClientId.set(player.id, createEmptyAsteroidStats(player))
    })
    gameInProgress = true
    gameOver = false
    resetAsteroids()
    startAsteroids()
    clients.forEach(sendGameStarted)
    broadcastScoreState()
    broadcastLifeState()
  }

  const handlePlayerHit = (client: LobbyClient) => {
    if (!gameInProgress || gameOver || !client.username) {
      return
    }

    const currentLives = livesByClientId.get(client.id) ?? gameConfig.playerStartingLives

    if (currentLives <= 0) {
      return
    }

    livesByClientId.set(client.id, Math.max(0, currentLives - 1))
    broadcastLifeState()

    const players = getLifeState().players

    if (players.length > 0 && players.every((player) => player.isEliminated)) {
      gameOver = true
      gameInProgress = false
      stopAsteroids()
      broadcastGameOver()
    }
  }

  const handleAsteroidHit = (client: LobbyClient, asteroidIdToHit: string) => {
    const asteroid = asteroids.find((nextAsteroid) => nextAsteroid.id === asteroidIdToHit)

    if (!asteroid) {
      return
    }

    scoresByClientId.set(
      client.id,
      (scoresByClientId.get(client.id) ?? 0) + asteroidScoreBySize[asteroid.size]
    )
    recordAsteroidDestroyed(client, asteroid)
    asteroids = asteroids.filter((nextAsteroid) => nextAsteroid.id !== asteroidIdToHit)
    asteroidsDestroyed += 1
    const children = splitAsteroid(
      asteroid,
      createAsteroidId,
      Math.random,
      getAsteroidSpeedMultiplier(asteroidsSpawned, asteroidsDestroyed)
    ).map(nameAsteroid)
    asteroidsSpawned += children.length
    asteroids = [...asteroids, ...children]
    fillAsteroidTarget()
    broadcastScoreState()
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

  const broadcastProjectileFired = (
    client: LobbyClient,
    projectile: Extract<ClientLobbyMessage, { type: "projectileFired" }>["projectile"]
  ) => {
    const message: ServerLobbyMessage = {
      type: "projectileFired",
      playerId: client.id,
      projectile
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

      if (message.type === "setAsteroidNames") {
        asteroidNames = message.asteroidNames
        broadcastLobbyState()
        return
      }

      if (message.type === "playerState") {
        if (client.username && !gameOver && (livesByClientId.get(client.id) ?? gameConfig.playerStartingLives) > 0) {
          broadcastPlayerState(client, message.ship)
        }

        return
      }

      if (message.type === "playerHit") {
        handlePlayerHit(client)
        return
      }

      if (message.type === "projectileFired") {
        if (client.username && !gameOver && (livesByClientId.get(client.id) ?? gameConfig.playerStartingLives) > 0) {
          broadcastProjectileFired(client, message.projectile)
        }

        return
      }

      if (message.type === "asteroidHit") {
        handleAsteroidHit(client, message.asteroidId)
        return
      }

      if (message.username.length > 0) {
        client.username = message.username
        broadcastLobbyState()
        broadcastScoreState()
        broadcastLifeState()
      }
    })

    socket.on("close", () => {
      clients.delete(client.id)
      broadcastLobbyState()
      broadcastScoreState()
      broadcastLifeState()
    })
  }

  return {
    addClient,
    getPlayers,
    stop: stopAsteroids
  }
}
