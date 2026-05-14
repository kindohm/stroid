import { randomUUID } from "node:crypto"
import type { WebSocket } from "ws"
import { gameConfig } from "../../../shared/game-config"
import type { Asteroid } from "../../../shared/game-types"
import type {
  AsteroidNamePools,
  ClientLobbyMessage,
  GameRecapEvent,
  LobbySummary,
  ServerLobbyMessage
} from "../../../shared/lobby-types"
import { defaultRoomSettings, sanitizeRoomSettings, type RoomSettings } from "../../../shared/room-settings"
import { asteroidNameSizeByAsteroidSize } from "../asteroid-name-size-by-asteroid-size"
import { createLobbyAsteroids } from "../create-lobby-asteroids"
import { createLobbyBroadcaster } from "../create-lobby-broadcaster"
import { createLobbyPowerUps } from "../create-lobby-power-ups"
import { defaultAsteroidNames } from "../default-asteroid-names"
import type { LobbyClient } from "../lobby-client"
import { parseClientMessage } from "../parse-client-message"
import { sendMessage } from "../send-message"
import { asteroidScoreBySize } from "./asteroid-score-by-size"
import { createAsteroidStatsTracker } from "./create-asteroid-stats-tracker"
import { createGameRecap } from "./create-game-recap"
import { createLifeState } from "./create-life-state"
import { createPowerUpEffectStore } from "./create-power-up-effect-store"
import { createScoreState } from "./create-score-state"
import { getLobbyPlayers } from "./get-lobby-players"
import type { LobbyArgs } from "./lobby-args"

const recapEventLimit = 40

export const createLobby = ({
  hostId = "",
  slug = "local-lobby",
  onChanged,
  onEmpty
}: Partial<LobbyArgs> = {}) => {
  const clients = new Map<string, LobbyClient>()
  const broadcaster = createLobbyBroadcaster({ clients })
  const scoresByClientId = new Map<string, number>()
  const livesByClientId = new Map<string, number>()
  const asteroidStats = createAsteroidStatsTracker()
  const powerUpEffects = createPowerUpEffectStore()
  let hostClientId = hostId
  let gameStartedAt = Date.now()
  let recapEvents: GameRecapEvent[] = []
  let asteroidNames = defaultAsteroidNames
  let settings: RoomSettings = defaultRoomSettings
  let gameInProgress = false
  let gameOver = false

  const getPlayers = () => getLobbyPlayers(clients)

  const getSummary = (): LobbySummary => ({
    slug,
    hostId: hostClientId,
    hostUsername: clients.get(hostClientId)?.username ?? "unknown pilot",
    playerCount: getPlayers().length,
    gameInProgress
  })

  const getScoreState = () => createScoreState(getPlayers(), scoresByClientId)

  const getLifeState = () => createLifeState(getPlayers(), livesByClientId, settings.playerLives)

  const getElapsedSeconds = () => Math.max(0, (Date.now() - gameStartedAt) / 1000)

  const recordRecapEvent = (event: GameRecapEvent) => {
    recapEvents = [...recapEvents, event].slice(-recapEventLimit)
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
      effects: powerUpEffects.getEffects()
    })
  }

  const broadcastGameOver = () => {
    broadcaster.sendToJoined({
      type: "gameOver",
      scores: getScoreState(),
      lives: getLifeState(),
      asteroidStats: asteroidStats.getState(getPlayers()),
      recap: createGameRecap({
        events: recapEvents,
        elapsedSeconds: getElapsedSeconds()
      })
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
    isFrozen: powerUpEffects.hasActiveAsteroidFreeze,
    onChanged: broadcastAsteroidState
  })

  const lobbyPowerUps = createLobbyPowerUps({
    getSettings: () => settings,
    onChanged: (nextPowerUps) => {
      if (powerUpEffects.expire()) {
        broadcastPowerUpEffectState()
      }

      broadcaster.sendToJoined({
        type: "powerUpState",
        powerUps: nextPowerUps
      })
    }
  })

  const sendGameStarted = (client: LobbyClient) => {
    if (!client.username) {
      return
    }

    sendMessage(client, {
      type: "gameStarted",
      slug,
      hostId: hostClientId,
      selfId: client.id,
      players: getPlayers(),
      asteroidNames,
      settings
    })
  }

  const broadcastGameStarted = () => {
    const players = getPlayers()

    scoresByClientId.clear()
    livesByClientId.clear()
    asteroidStats.clear()
    powerUpEffects.clear()
    players.forEach((player) => {
      livesByClientId.set(player.id, settings.playerLives)
    })
    asteroidStats.createForPlayers(players)
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
    broadcaster.sendToJoinedExcept({
      type: "playerDestroyed",
      playerId: client.id,
      ship
    }, client.id)
  }

  const endGame = () => {
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
    const player = getPlayers().find((nextPlayer) => nextPlayer.id === client.id)

    livesByClientId.set(client.id, nextLives)
    broadcastPlayerDestroyed(client, ship)

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

    if (players.length > 0 && players.every((nextPlayer) => nextPlayer.isEliminated)) {
      endGame()
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

    const scoreDelta = asteroidScoreBySize[asteroid.size]
    const player = getPlayers().find((nextPlayer) => nextPlayer.id === client.id)

    scoresByClientId.set(client.id, (scoresByClientId.get(client.id) ?? 0) + scoreDelta)

    if (player) {
      recordRecapEvent({
        type: "asteroidDestroyed",
        elapsedSeconds: getElapsedSeconds(),
        player,
        asteroidName: asteroid.name ?? "unnamed",
        asteroidSize: asteroidNameSizeByAsteroidSize[asteroid.size],
        scoreDelta
      })
    }

    asteroidStats.recordDestroyed(player, asteroid)
    broadcaster.sendToJoined({
      type: "asteroidDestroyed",
      asteroid: {
        id: asteroid.id,
        position: asteroid.position,
        radius: asteroid.radius,
        size: asteroid.size
      }
    })
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
    const player = getPlayers().find((nextPlayer) => nextPlayer.id === client.id)

    powerUpEffects.setEffect(client.id, powerUp.type, effectExpiresAt)
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
    broadcaster.sendToJoinedExcept({
      type: "playerState",
      playerId: client.id,
      ship
    }, client.id)
  }

  const broadcastProjectileFired = (
    client: LobbyClient,
    projectile: Extract<ClientLobbyMessage, { type: "projectileFired" }>["projectile"]
  ) => {
    broadcaster.sendToJoinedExcept({
      type: "projectileFired",
      playerId: client.id,
      projectile
    }, client.id)
  }

  const removeClient = (client: LobbyClient) => {
    clients.delete(client.id)
    powerUpEffects.deletePlayer(client.id)
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
