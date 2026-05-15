import { randomUUID } from "node:crypto"
import type { WebSocket } from "ws"
import { createBossAsteroid } from "../../../game/create-boss-asteroid"
import { createBossDefeatAsteroids } from "../../../game/create-boss-defeat-asteroids"
import { updateBossAsteroid } from "../../../game/update-boss-asteroid"
import { gameConfig } from "../../../shared/game-config"
import type { Asteroid, BossAsteroid } from "../../../shared/game-types"
import type {
  AsteroidNamePools,
  ClientLobbyMessage,
  GameRecapEvent,
  LobbySummary,
  ServerLobbyMessage
} from "../../../shared/lobby-types"
import { createGameWorld, defaultRoomSettings, sanitizeRoomSettings, type RoomSettings } from "../../../shared/room-settings"
import { asteroidNameSizeByAsteroidSize } from "../asteroid-name-size-by-asteroid-size"
import { createLobbyAsteroids } from "../create-lobby-asteroids"
import { createLobbyBroadcaster } from "../create-lobby-broadcaster"
import { createLobbyPowerUps } from "../create-lobby-power-ups"
import { defaultAsteroidNames } from "../default-asteroid-names"
import type { LobbyClient } from "../lobby-client"
import type { LobbySnapshot } from "../lobby-snapshot"
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
  hostSessionId = "",
  hostUsername = "unknown pilot",
  slug = "local-lobby",
  asteroidNames: initialAsteroidNames = defaultAsteroidNames,
  settings: initialSettings = defaultRoomSettings,
  createdAt = Date.now(),
  onChanged,
  onEmpty
}: Partial<LobbyArgs> = {}) => {
  const clients = new Map<string, LobbyClient>()
  const broadcaster = createLobbyBroadcaster({ clients })
  const scoresByClientId = new Map<string, number>()
  const livesByClientId = new Map<string, number>()
  const ghostPositionsByClientId = new Map<string, { x: number; y: number }>()
  const asteroidStats = createAsteroidStatsTracker()
  const powerUpEffects = createPowerUpEffectStore()
  let hostClientId = hostId
  let lobbyHostSessionId = hostSessionId
  let lobbyHostUsername = hostUsername
  let gameStartedAt = Date.now()
  let recapEvents: GameRecapEvent[] = []
  let asteroidNames = initialAsteroidNames
  let settings: RoomSettings = initialSettings
  let gameInProgress = false
  let gameOver = false
  let bossAsteroid: BossAsteroid | undefined
  let bossPreSpawnActive = false
  let bossId = 0
  let bossInterval: ReturnType<typeof setInterval> | undefined
  let lastBossTick = Date.now()
  let nextBossWindowAt = Date.now()

  const getPlayers = () => getLobbyPlayers(clients)

  const isActivePlayer = (client: LobbyClient) => Boolean(client.username && !client.isSpectator)

  const getSummary = (): LobbySummary => ({
    slug,
    hostId: hostClientId,
    hostUsername: clients.get(hostClientId)?.username ?? lobbyHostUsername,
    playerCount: getPlayers().length,
    gameInProgress
  })

  const getSnapshot = (): LobbySnapshot => ({
    slug,
    hostSessionId: lobbyHostSessionId,
    hostUsername: clients.get(hostClientId)?.username ?? lobbyHostUsername,
    asteroidNames,
    settings,
    createdAt,
    updatedAt: Date.now()
  })

  const getScoreState = () => createScoreState(getPlayers(), scoresByClientId)

  const getLifeState = () => createLifeState(getPlayers(), livesByClientId, settings.playerLives, ghostPositionsByClientId)

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

  const reclaimHostIfNeeded = (client: LobbyClient) => {
    if (!client.sessionId) {
      return
    }

    if (!lobbyHostSessionId) {
      lobbyHostSessionId = client.sessionId
    }

    if (client.sessionId === lobbyHostSessionId) {
      hostClientId = client.id
      lobbyHostUsername = client.username ?? lobbyHostUsername
    }
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

  const broadcastBossState = () => {
    broadcaster.sendToJoined({
      type: "bossState",
      boss: bossAsteroid,
      preSpawnActive: bossPreSpawnActive,
      nextBossWindowAt,
      bossIntervalMs: settings.bossIntervalMinutes * 60 * 1000
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

  const arePlayersReady = () => {
    const players = getPlayers()

    return players.length > 0 && players.every((player) => player.isReady)
  }

  const resetReadyState = () => {
    clients.forEach((client) => {
      client.isReady = false
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
    canSpawn: () => !bossPreSpawnActive && !bossAsteroid,
    onChanged: broadcastAsteroidState
  })

  const lobbyPowerUps = createLobbyPowerUps({
    getSettings: () => settings,
    canSpawn: () => !bossPreSpawnActive && !bossAsteroid,
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
      settings,
      isSpectator: client.isSpectator
    })
  }

  const sendCurrentGameState = (client: LobbyClient) => {
    sendGameStarted(client)
    sendMessage(client, {
      type: "scoreState",
      scores: getScoreState()
    })
    sendMessage(client, {
      type: "lifeState",
      lives: getLifeState()
    })
    sendMessage(client, {
      type: "asteroidState",
      asteroids: lobbyAsteroids.getAsteroids()
    })
    sendMessage(client, {
      type: "powerUpState",
      powerUps: lobbyPowerUps.getPowerUps()
    })
    sendMessage(client, {
      type: "powerUpEffectState",
      effects: powerUpEffects.getEffects()
    })
    sendMessage(client, {
      type: "bossState",
      boss: bossAsteroid,
      preSpawnActive: bossPreSpawnActive,
      nextBossWindowAt,
      bossIntervalMs: settings.bossIntervalMinutes * 60 * 1000
    })
  }

  const createBossId = () => {
    bossId += 1
    return `boss-${bossId}`
  }

  const getBossName = () => {
    const names = asteroidNames.boss

    return names[Math.floor(Math.random() * names.length)] ?? "boss"
  }

  const stopBossInterval = () => {
    if (bossInterval) {
      clearInterval(bossInterval)
      bossInterval = undefined
    }
  }

  const startBossPreSpawn = () => {
    if (bossPreSpawnActive || bossAsteroid || !gameInProgress || gameOver) {
      return
    }

    bossPreSpawnActive = true
    broadcastBossState()
  }

  const spawnBoss = () => {
    const maxHealth = Math.max(1, getPlayers().length) * settings.bossHealthPerPlayer

    bossAsteroid = createBossAsteroid(createBossId(), getBossName(), createGameWorld(settings), maxHealth)
    bossPreSpawnActive = false
    broadcastBossState()
  }

  const startBossInterval = () => {
    stopBossInterval()
    bossInterval = setInterval(() => {
      if (!gameInProgress || gameOver) {
        return
      }

      const now = Date.now()

      if (!bossPreSpawnActive && !bossAsteroid && now >= nextBossWindowAt) {
        startBossPreSpawn()
      }

      if (bossPreSpawnActive && lobbyAsteroids.getAsteroids().length === 0) {
        spawnBoss()
      }

      if (bossAsteroid) {
        const deltaSeconds = Math.min(0.1, (now - lastBossTick) / 1000)

        bossAsteroid = updateBossAsteroid(bossAsteroid, deltaSeconds, createGameWorld(settings))
        broadcastBossState()
      }

      lastBossTick = now
    }, gameConfig.asteroidStateBroadcastIntervalMs)
  }

  const broadcastGameStarted = () => {
    const players = getPlayers()

    scoresByClientId.clear()
    livesByClientId.clear()
    ghostPositionsByClientId.clear()
    asteroidStats.clear()
    powerUpEffects.clear()
    bossAsteroid = undefined
    bossPreSpawnActive = false
    bossId = 0
    resetReadyState()
    lastBossTick = Date.now()
    nextBossWindowAt = lastBossTick + settings.bossIntervalMinutes * 60 * 1000
    players.forEach((player) => {
      livesByClientId.set(player.id, settings.playerLives)
    })
    asteroidStats.createForPlayers(players)
    gameInProgress = true
    gameOver = false
    clients.forEach((client) => {
      client.isSpectator = false
    })
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
    startBossInterval()
    clients.forEach(sendGameStarted)
    broadcastScoreState()
    broadcastLifeState()
    broadcastPowerUpEffectState()
    broadcastBossState()
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
    stopBossInterval()
    recordRecapEvent({
      type: "gameOver",
      elapsedSeconds: getElapsedSeconds(),
      label: "all ships lost"
    })
    resetReadyState()
    clients.forEach((client) => {
      client.isSpectator = false
    })
    broadcastGameOver()
    broadcastLobbyState()
  }

  const handlePlayerHit = (
    client: LobbyClient,
    ship: Extract<ClientLobbyMessage, { type: "playerHit" }>["ship"],
    cause: Extract<ClientLobbyMessage, { type: "playerHit" }>["cause"] = "unknown"
  ) => {
    if (!gameInProgress || gameOver || !isActivePlayer(client)) {
      return
    }

    const currentLives = livesByClientId.get(client.id) ?? settings.playerLives

    if (currentLives <= 0) {
      return
    }

    const nextLives = Math.max(0, currentLives - 1)
    const player = getPlayers().find((nextPlayer) => nextPlayer.id === client.id)

    livesByClientId.set(client.id, nextLives)
    if (nextLives <= 0) {
      ghostPositionsByClientId.set(client.id, ship.position)
    }
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

  const handleRevivePlayer = (client: LobbyClient, playerId: string) => {
    if (!isActivePlayer(client) || !gameInProgress || gameOver || client.id === playerId) {
      return
    }

    if ((livesByClientId.get(client.id) ?? settings.playerLives) <= 0) {
      return
    }

    if ((livesByClientId.get(playerId) ?? settings.playerLives) > 0 || !ghostPositionsByClientId.has(playerId)) {
      return
    }

    livesByClientId.set(playerId, 1)
    ghostPositionsByClientId.delete(playerId)
    broadcastLifeState()
  }

  const handleAsteroidHit = (client: LobbyClient, asteroidIdToHit: string) => {
    if (!isActivePlayer(client) || !gameInProgress || gameOver) {
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
    if (!isActivePlayer(client) || !gameInProgress || gameOver) {
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

  const handleBossHit = (client: LobbyClient, bossIdToHit: string) => {
    if (!isActivePlayer(client) || !gameInProgress || gameOver || !bossAsteroid || bossAsteroid.id !== bossIdToHit) {
      return
    }

    const nextBoss = {
      ...bossAsteroid,
      health: Math.max(0, bossAsteroid.health - 1)
    }

    scoresByClientId.set(
      client.id,
      (scoresByClientId.get(client.id) ?? 0) + gameConfig.bossProjectileHitScore
    )

    if (nextBoss.health > 0) {
      bossAsteroid = nextBoss
      broadcaster.sendToJoined({
        type: "bossHit",
        boss: bossAsteroid,
        playerId: client.id,
        scoreDelta: gameConfig.bossProjectileHitScore
      })
      broadcastScoreState()
      broadcastBossState()
      return
    }

    const defeatedBoss = nextBoss

    getPlayers().forEach((player) => {
      scoresByClientId.set(
        player.id,
        (scoresByClientId.get(player.id) ?? 0) + gameConfig.bossDefeatScorePerPlayer
      )
    })
    bossAsteroid = undefined
    bossPreSpawnActive = false
    nextBossWindowAt = Date.now() + settings.bossIntervalMinutes * 60 * 1000
    lobbyAsteroids.addAsteroids(createBossDefeatAsteroids(defeatedBoss, () => `boss-shard-${createBossId()}`))
    broadcaster.sendToJoined({
      type: "bossDefeated",
      boss: defeatedBoss,
      scoreDelta: gameConfig.bossDefeatScorePerPlayer
    })
    broadcastScoreState()
    broadcastBossState()
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
      stopBossInterval()
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
        client.isReady = false
        client.stats = message.stats
        reclaimHostIfNeeded(client)
        broadcastLobbyState()
        broadcastScoreState()
        broadcastLifeState()
        if (gameInProgress && client.isSpectator) {
          sendCurrentGameState(client)
        }
      }

      return
    }

    if (message.type === "setPlayerStats") {
      if (client.username) {
        client.stats = message.stats
        broadcastLobbyState()
      }

      return
    }

    if (message.type === "setReady") {
      if (isActivePlayer(client) && !gameInProgress) {
        client.isReady = message.isReady
        broadcastLobbyState()
      }

      return
    }

    if (message.type === "startGame") {
      if (client.id === hostClientId && isActivePlayer(client) && !gameInProgress && arePlayersReady()) {
        broadcastGameStarted()
      }

      return
    }

    if (message.type === "setAsteroidNames") {
      if (client.id === hostClientId && isActivePlayer(client) && !gameInProgress) {
        asteroidNames = message.asteroidNames
        broadcastLobbyState()
      }

      return
    }

    if (message.type === "setRoomSettings") {
      if (client.id === hostClientId && isActivePlayer(client) && !gameInProgress) {
        settings = sanitizeRoomSettings(message.settings)
        broadcastLobbyState()
      }

      return
    }

    if (message.type === "playerState") {
      if (isActivePlayer(client) && !gameOver && (livesByClientId.get(client.id) ?? settings.playerLives) > 0) {
        broadcastPlayerState(client, message.ship)
      }

      return
    }

    if (message.type === "playerHit") {
      handlePlayerHit(client, message.ship, message.cause)
      return
    }

    if (message.type === "revivePlayer") {
      handleRevivePlayer(client, message.playerId)
      return
    }

    if (message.type === "projectileFired") {
      if (isActivePlayer(client) && !gameOver && (livesByClientId.get(client.id) ?? settings.playerLives) > 0) {
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
      return
    }

    if (message.type === "bossHit") {
      handleBossHit(client, message.bossId)
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
    client.isSpectator = gameInProgress
    reclaimHostIfNeeded(client)

    if (getPlayers().length === 0 && initialAsteroidNames) {
      asteroidNames = initialAsteroidNames
    }

    sendLobbyState(client)
    broadcastLobbyState()
    broadcastScoreState()
    broadcastLifeState()

    if (gameInProgress && client.username) {
      sendCurrentGameState(client)
    }

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
    getSnapshot,
    getSummary,
    handleMessage,
    hasClient: (clientId: string) => clients.has(clientId),
    isJoinable: () => !gameInProgress,
    removeClient,
    stop: () => {
      lobbyAsteroids.stop()
      lobbyPowerUps.stop()
      stopBossInterval()
    }
  }
}
