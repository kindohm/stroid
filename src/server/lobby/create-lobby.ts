import { randomUUID } from "node:crypto"
import type { WebSocket } from "ws"
import { assignPlayerColor } from "../../game/assign-player-color"
import { gameConfig } from "../../shared/game-config"
import type { ActivePowerUpEffect, Asteroid, AsteroidSize, PowerUpType } from "../../shared/game-types"
import type {
  AsteroidNamePools,
  AsteroidStatsState,
  ClientLobbyMessage,
  GameRecap,
  GameRecapEvent,
  LifeState,
  LobbyPlayer,
  LobbySummary,
  PlayerAsteroidStats,
  ScoreState,
  ServerLobbyMessage
} from "../../shared/lobby-types"
import { defaultRoomSettings, sanitizeRoomSettings, type RoomSettings } from "../../shared/room-settings"
import { asteroidNameSizeByAsteroidSize } from "./asteroid-name-size-by-asteroid-size"
import { createLobbyAsteroids } from "./create-lobby-asteroids"
import { createLobbyBroadcaster } from "./create-lobby-broadcaster"
import { createLobbyPowerUps } from "./create-lobby-power-ups"
import { defaultAsteroidNames } from "./default-asteroid-names"
import type { LobbyClient } from "./lobby-client"
import { parseClientMessage } from "./parse-client-message"
import { sendMessage } from "./send-message"

type LobbyArgs = {
  hostId: string
  slug: string
  onChanged?: () => void
  onEmpty?: (slug: string) => void
}

const asteroidScoreBySize: Record<AsteroidSize, number> = {
  extraLarge: 100,
  large: 100,
  medium: 200,
  small: 300
}

const recapEventLimit = 40
const finalRecapSeconds = 10
const scoreStreakSeconds = 5

export const createLobby = ({
  hostId = "",
  slug = "local-lobby",
  onChanged,
  onEmpty
}: Partial<LobbyArgs> = {}) => {
  const clients = new Map<string, LobbyClient>()
  const broadcaster = createLobbyBroadcaster({ clients })
  let hostClientId = hostId
  const scoresByClientId = new Map<string, number>()
  const livesByClientId = new Map<string, number>()
  const powerUpEffectsByClientId = new Map<string, Map<PowerUpType, number>>()
  const asteroidStatsByClientId = new Map<string, PlayerAsteroidStats>()
  let gameStartedAt = Date.now()
  let recapEvents: GameRecapEvent[] = []
  let asteroidNames = defaultAsteroidNames
  let settings: RoomSettings = defaultRoomSettings
  let gameInProgress = false
  let gameOver = false

  const getPlayers = (): LobbyPlayer[] =>
    [...clients.values()]
      .filter((client) => typeof client.username === "string" && client.username.length > 0)
      .map((client) => ({
        id: client.id,
        username: client.username ?? "",
        color: assignPlayerColor(client.username ?? "")
      }))

  const getSummary = (): LobbySummary => ({
    slug,
    hostId: hostClientId,
    hostUsername: clients.get(hostClientId)?.username ?? "unknown pilot",
    playerCount: getPlayers().length,
    gameInProgress
  })

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
      const lives = livesByClientId.get(player.id) ?? settings.playerLives

      return {
        ...player,
        lives,
        isEliminated: lives <= 0
      }
    })
  })

  const getElapsedSeconds = () => Math.max(0, (Date.now() - gameStartedAt) / 1000)

  const recordRecapEvent = (event: GameRecapEvent) => {
    recapEvents = [...recapEvents, event].slice(-recapEventLimit)
  }

  const createRecap = (): GameRecap => {
    const gameOverEvent = [...recapEvents].reverse().find((event) => event.type === "gameOver")
    const gameLengthSeconds = gameOverEvent?.elapsedSeconds ?? getElapsedSeconds()
    const asteroidEvents = recapEvents.filter((event) => event.type === "asteroidDestroyed")
    const playerDestroyedEvents = recapEvents.filter((event) => event.type === "playerDestroyed")
    const streaks = asteroidEvents.flatMap((event, index) => {
      const streakEvents = asteroidEvents.filter(
        (nextEvent) =>
          nextEvent.player.id === event.player.id &&
          nextEvent.elapsedSeconds >= event.elapsedSeconds &&
          nextEvent.elapsedSeconds - event.elapsedSeconds <= scoreStreakSeconds
      )

      if (streakEvents.length === 0 || asteroidEvents.findIndex((nextEvent) => nextEvent === event) !== index) {
        return []
      }

      return [{
        player: event.player,
        score: streakEvents.reduce((total, streakEvent) => total + streakEvent.scoreDelta, 0),
        asteroidCount: streakEvents.length,
        startedAt: event.elapsedSeconds,
        endedAt: streakEvents.at(-1)?.elapsedSeconds ?? event.elapsedSeconds
      }]
    })
    const biggestScoreStreak = streaks
      .sort((left, right) => right.score - left.score || right.asteroidCount - left.asteroidCount)[0]

    return {
      events: recapEvents,
      highlights: {
        firstPlayerHit: playerDestroyedEvents[0],
        finalAsteroidDestroyed: asteroidEvents.at(-1),
        biggestScoreStreak,
        finalTenSeconds: recapEvents.filter((event) => gameLengthSeconds - event.elapsedSeconds <= finalRecapSeconds)
      }
    }
  }

  const getPowerUpEffects = (): ActivePowerUpEffect[] => {
    const now = Date.now()

    return [...powerUpEffectsByClientId.entries()].flatMap(([playerId, effectsByType]) =>
      [...effectsByType.entries()]
        .filter(([, expiresAt]) => expiresAt > now)
        .map(([type, expiresAt]) => ({
          playerId,
          type,
          expiresAt
        }))
    )
  }

  const expirePowerUpEffects = () => {
    const now = Date.now()
    let changed = false

    powerUpEffectsByClientId.forEach((effectsByType, clientId) => {
      effectsByType.forEach((expiresAt, type) => {
        if (expiresAt <= now) {
          effectsByType.delete(type)
          changed = true
        }
      })

      if (effectsByType.size === 0) {
        powerUpEffectsByClientId.delete(clientId)
      }
    })

    return changed
  }

  const hasActiveAsteroidFreeze = () =>
    getPowerUpEffects().some((effect) => effect.type === "asteroidFreeze")

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

    const size = asteroidNameSizeByAsteroidSize[asteroid.size]
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
      slug,
      hostId: hostClientId,
      selfId: client.id,
      players: getPlayers(),
      asteroidNames,
      settings
    }

    sendMessage(client, message)
  }

  const broadcastScoreState = () => {
    broadcaster.sendToJoined({
      type: "scoreState",
      scores: getScoreState()
    })
  }

  const broadcastLifeState = () => {
    broadcaster.sendToJoined({
      type: "lifeState",
      lives: getLifeState()
    })
  }

  const broadcastPowerUpEffectState = () => {
    broadcaster.sendToJoined({
      type: "powerUpEffectState",
      effects: getPowerUpEffects()
    })
  }

  const broadcastGameOver = () => {
    broadcaster.sendToJoined({
      type: "gameOver",
      scores: getScoreState(),
      lives: getLifeState(),
      asteroidStats: getAsteroidStatsState(),
      recap: createRecap()
    })
  }

  const broadcastLobbyState = () => {
    clients.forEach(sendLobbyState)
    onChanged?.()
  }

  const broadcastAsteroidState = (asteroids: Asteroid[]) => {
    broadcaster.sendToJoined({
      type: "asteroidState",
      asteroids
    })
  }

  const lobbyAsteroids = createLobbyAsteroids({
    getAsteroidNames: () => asteroidNames,
    getSettings: () => settings,
    isFrozen: hasActiveAsteroidFreeze,
    onChanged: broadcastAsteroidState
  })

  const lobbyPowerUps = createLobbyPowerUps({
    getSettings: () => settings,
    onChanged: (powerUps) => {
      if (expirePowerUpEffects()) {
        broadcastPowerUpEffectState()
      }

      broadcaster.sendToJoined({
        type: "powerUpState",
        powerUps
      })
    }
  })

  const sendGameStarted = (client: LobbyClient) => {
    if (!client.username) {
      return
    }

    const message: ServerLobbyMessage = {
      type: "gameStarted",
      slug,
      hostId: hostClientId,
      selfId: client.id,
      players: getPlayers(),
      asteroidNames,
      settings
    }

    sendMessage(client, message)
  }

  const broadcastGameStarted = () => {
    scoresByClientId.clear()
    livesByClientId.clear()
    asteroidStatsByClientId.clear()
    powerUpEffectsByClientId.clear()
    getPlayers().forEach((player) => {
      livesByClientId.set(player.id, settings.playerLives)
      asteroidStatsByClientId.set(player.id, createEmptyAsteroidStats(player))
    })
    gameInProgress = true
    gameOver = false
    gameStartedAt = Date.now()
    recapEvents = []
    recordRecapEvent({
      type: "gameStarted",
      elapsedSeconds: 0,
      label: "room launched"
    })
    lobbyAsteroids.reset()
    lobbyPowerUps.reset()
    lobbyAsteroids.start()
    lobbyPowerUps.start()
    clients.forEach(sendGameStarted)
    broadcastScoreState()
    broadcastLifeState()
    broadcastPowerUpEffectState()
    onChanged?.()
  }

  const broadcastPlayerDestroyed = (
    client: LobbyClient,
    ship: Extract<ClientLobbyMessage, { type: "playerHit" }>["ship"]
  ) => {
    const message: ServerLobbyMessage = {
      type: "playerDestroyed",
      playerId: client.id,
      ship
    }

    broadcaster.sendToJoinedExcept(message, client.id)
  }

  const handlePlayerHit = (
    client: LobbyClient,
    ship: Extract<ClientLobbyMessage, { type: "playerHit" }>["ship"],
    cause: Extract<ClientLobbyMessage, { type: "playerHit" }>["cause"] = "unknown"
  ) => {
    if (!gameInProgress || gameOver || !client.username) {
      return
    }

    const currentLives = livesByClientId.get(client.id) ?? settings.playerLives

    if (currentLives <= 0) {
      return
    }

    const nextLives = Math.max(0, currentLives - 1)

    livesByClientId.set(client.id, nextLives)
    broadcastPlayerDestroyed(client, ship)
    const player = getPlayers().find((nextPlayer) => nextPlayer.id === client.id)

    if (player) {
      recordRecapEvent({
        type: "playerDestroyed",
        elapsedSeconds: getElapsedSeconds(),
        player,
        cause: cause ?? "unknown",
        livesRemaining: nextLives
      })
    }
    broadcastLifeState()

    const players = getLifeState().players

    if (players.length > 0 && players.every((player) => player.isEliminated)) {
      gameOver = true
      gameInProgress = false
      lobbyAsteroids.stop()
      lobbyPowerUps.stop()
      recordRecapEvent({
        type: "gameOver",
        elapsedSeconds: getElapsedSeconds(),
        label: "all ships lost"
      })
      broadcastGameOver()
      onChanged?.()
    }
  }

  const handleAsteroidHit = (client: LobbyClient, asteroidIdToHit: string) => {
    if (!client.username || !gameInProgress || gameOver) {
      return
    }

    const asteroid = lobbyAsteroids.destroy(asteroidIdToHit)

    if (!asteroid) {
      return
    }

    scoresByClientId.set(
      client.id,
      (scoresByClientId.get(client.id) ?? 0) + asteroidScoreBySize[asteroid.size]
    )
    const player = getPlayers().find((nextPlayer) => nextPlayer.id === client.id)
    const asteroidNameSize = asteroidNameSizeByAsteroidSize[asteroid.size]

    if (player) {
      recordRecapEvent({
        type: "asteroidDestroyed",
        elapsedSeconds: getElapsedSeconds(),
        player,
        asteroidName: asteroid.name ?? "unnamed",
        asteroidSize: asteroidNameSize,
        scoreDelta: asteroidScoreBySize[asteroid.size]
      })
    }
    const destroyedMessage: ServerLobbyMessage = {
      type: "asteroidDestroyed",
      asteroid: {
        id: asteroid.id,
        position: asteroid.position,
        radius: asteroid.radius,
        size: asteroid.size
      }
    }

    recordAsteroidDestroyed(client, asteroid)
    broadcaster.sendToJoined(destroyedMessage)
    broadcastScoreState()
    broadcastAsteroidState(lobbyAsteroids.getAsteroids())
  }

  const handlePowerUpHit = (client: LobbyClient, powerUpIdToHit: string) => {
    if (!client.username || !gameInProgress || gameOver) {
      return
    }

    const powerUp = lobbyPowerUps.destroy(powerUpIdToHit)

    if (!powerUp) {
      return
    }

    const effectExpiresAt = Date.now() + gameConfig.powerUpEffectSeconds * 1000
    const effectsByType = powerUpEffectsByClientId.get(client.id) ?? new Map<PowerUpType, number>()
    const player = getPlayers().find((nextPlayer) => nextPlayer.id === client.id)

    effectsByType.set(powerUp.type, effectExpiresAt)
    powerUpEffectsByClientId.set(client.id, effectsByType)
    if (player) {
      recordRecapEvent({
        type: "powerUpCollected",
        elapsedSeconds: getElapsedSeconds(),
        player,
        powerUpType: powerUp.type
      })
    }
    broadcaster.sendToJoined({
      type: "powerUpCollected",
      playerId: client.id,
      powerUp,
      effectExpiresAt
    })
    broadcastPowerUpEffectState()
  }

  const broadcastPlayerState = (
    client: LobbyClient,
    ship: Extract<ClientLobbyMessage, { type: "playerState" }>["ship"]
  ) => {
    const message: ServerLobbyMessage = {
      type: "playerState",
      playerId: client.id,
      ship
    }

    broadcaster.sendToJoinedExcept(message, client.id)
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

    broadcaster.sendToJoinedExcept(message, client.id)
  }

  const removeClient = (client: LobbyClient) => {
    clients.delete(client.id)
    powerUpEffectsByClientId.delete(client.id)
    broadcastLobbyState()
    broadcastScoreState()
    broadcastLifeState()
    broadcastPowerUpEffectState()

    if (clients.size === 0) {
      lobbyAsteroids.stop()
      lobbyPowerUps.stop()
      onEmpty?.(slug)
    }
  }

  const handleMessage = (client: LobbyClient, message: ClientLobbyMessage) => {
    if (!clients.has(client.id)) {
      return
    }

    if (message.type === "renamePlayer") {
      if (message.username.length > 0) {
        if (getPlayers().length === 0 && message.asteroidNames) {
          asteroidNames = message.asteroidNames
        }

        client.username = message.username
        broadcastLobbyState()
        broadcastScoreState()
        broadcastLifeState()
      }

      return
    }

    if (message.type === "startGame") {
      if (client.id === hostClientId && client.username && getPlayers().length > 0 && !gameInProgress) {
        broadcastGameStarted()
      }

      return
    }

    if (message.type === "setAsteroidNames") {
      if (client.username && !gameInProgress) {
        asteroidNames = message.asteroidNames
        broadcastLobbyState()
      }

      return
    }

    if (message.type === "setRoomSettings") {
      if (client.id === hostClientId && client.username && !gameInProgress) {
        settings = sanitizeRoomSettings(message.settings)
        broadcastLobbyState()
      }

      return
    }

    if (message.type === "playerState") {
      if (client.username && !gameOver && (livesByClientId.get(client.id) ?? settings.playerLives) > 0) {
        broadcastPlayerState(client, message.ship)
      }

      return
    }

    if (message.type === "playerHit") {
      handlePlayerHit(client, message.ship, message.cause)
      return
    }

    if (message.type === "projectileFired") {
      if (client.username && !gameOver && (livesByClientId.get(client.id) ?? settings.playerLives) > 0) {
        broadcastProjectileFired(client, message.projectile)
      }

      return
    }

    if (message.type === "asteroidHit") {
      handleAsteroidHit(client, message.asteroidId)
      return
    }

    if (message.type === "powerUpHit") {
      handlePowerUpHit(client, message.powerUpId)
    }
  }

  const addClient = (clientOrSocket: LobbyClient | WebSocket, initialAsteroidNames?: AsteroidNamePools) => {
    const client = "socket" in clientOrSocket
      ? clientOrSocket
      : {
          id: randomUUID(),
          socket: clientOrSocket
        }

    if (!hostClientId) {
      hostClientId = client.id
    }

    clients.set(client.id, client)

    if (getPlayers().length === 0 && initialAsteroidNames) {
      asteroidNames = initialAsteroidNames
    }

    sendLobbyState(client)
    broadcastLobbyState()
    broadcastScoreState()
    broadcastLifeState()

    if (!("socket" in clientOrSocket)) {
      client.socket.on("message", (data) => {
        const message = parseClientMessage(data)

        if (message) {
          handleMessage(client, message)
        }
      })

      client.socket.on("close", () => {
        removeClient(client)
      })
    }
  }

  return {
    addClient,
    getPlayers,
    getSummary,
    handleMessage,
    hasClient: (clientId: string) => clients.has(clientId),
    isJoinable: () => !gameInProgress,
    removeClient,
    stop: () => {
      lobbyAsteroids.stop()
      lobbyPowerUps.stop()
    }
  }
}
