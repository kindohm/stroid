import type { Asteroid, BossAsteroid, Projectile } from "../../shared/game-types"
import type {
  AsteroidNamePools,
  ClientLobbyMessage,
  NetworkPlayerShip,
  PlayerDeathCause,
  ServerLobbyMessage
} from "../../shared/lobby-types"
import { sanitizeRoomSettings } from "../../shared/room-settings"
import type { RoomSettings } from "../../shared/room-settings"

export type CreateLobbyConnectionArgs = {
  onUsernameAccepted: (message: Extract<ServerLobbyMessage, { type: "usernameAccepted" }>) => void
  onUsernameRejected: (message: Extract<ServerLobbyMessage, { type: "usernameRejected" }>) => void
  onLobbyList: (message: Extract<ServerLobbyMessage, { type: "lobbyList" }>) => void
  onLobbyCreated: (message: Extract<ServerLobbyMessage, { type: "lobbyCreated" }>) => void
  onLobbyNotFound: (message: Extract<ServerLobbyMessage, { type: "lobbyNotFound" }>) => void
  onLobbyJoinRejected: (message: Extract<ServerLobbyMessage, { type: "lobbyJoinRejected" }>) => void
  onState: (message: Extract<ServerLobbyMessage, { type: "lobbyState" }>) => void
  onGameStarted: (message: Extract<ServerLobbyMessage, { type: "gameStarted" }>) => void
  onPlayerState: (message: Extract<ServerLobbyMessage, { type: "playerState" }>) => void
  onPlayerDestroyed: (message: Extract<ServerLobbyMessage, { type: "playerDestroyed" }>) => void
  onProjectileFired: (message: Extract<ServerLobbyMessage, { type: "projectileFired" }>) => void
  onAsteroidState: (message: Extract<ServerLobbyMessage, { type: "asteroidState" }>) => void
  onAsteroidDestroyed: (message: Extract<ServerLobbyMessage, { type: "asteroidDestroyed" }>) => void
  onPowerUpState: (message: Extract<ServerLobbyMessage, { type: "powerUpState" }>) => void
  onBossState: (message: Extract<ServerLobbyMessage, { type: "bossState" }>) => void
  onBossHit: (message: Extract<ServerLobbyMessage, { type: "bossHit" }>) => void
  onBossDefeated: (message: Extract<ServerLobbyMessage, { type: "bossDefeated" }>) => void
  onPowerUpCollected: (message: Extract<ServerLobbyMessage, { type: "powerUpCollected" }>) => void
  onPowerUpEffectState: (message: Extract<ServerLobbyMessage, { type: "powerUpEffectState" }>) => void
  onScoreState: (message: Extract<ServerLobbyMessage, { type: "scoreState" }>) => void
  onLifeState: (message: Extract<ServerLobbyMessage, { type: "lifeState" }>) => void
  onGameOver: (message: Extract<ServerLobbyMessage, { type: "gameOver" }>) => void
  onStatus: (status: "connected" | "connecting" | "disconnected") => void
}

const createSocketUrl = () => {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"

  return `${protocol}//${window.location.host}/ws`
}

export const parseServerMessage = (data: MessageEvent["data"]): ServerLobbyMessage | undefined => {
  try {
    const message = JSON.parse(String(data)) as Partial<ServerLobbyMessage>

    if (message.type === "usernameAccepted" && typeof message.username === "string") {
      return {
        type: "usernameAccepted",
        username: message.username
      }
    }

    if (message.type === "usernameRejected" && message.reason === "blank") {
      return {
        type: "usernameRejected",
        reason: "blank"
      }
    }

    if (message.type === "lobbyList" && Array.isArray(message.lobbies)) {
      return {
        type: "lobbyList",
        lobbies: message.lobbies
      } as ServerLobbyMessage
    }

    if (message.type === "lobbyCreated" && typeof message.lobby === "object" && message.lobby) {
      return {
        type: "lobbyCreated",
        lobby: message.lobby
      } as ServerLobbyMessage
    }

    if (message.type === "lobbyNotFound" && typeof message.slug === "string") {
      return {
        type: "lobbyNotFound",
        slug: message.slug
      }
    }

    if (
      message.type === "lobbyJoinRejected" &&
      (message.reason === "notFound" || message.reason === "gameInProgress" || message.reason === "missingUsername")
    ) {
      return {
        type: "lobbyJoinRejected",
        reason: message.reason
      }
    }

    if (
      (message.type === "lobbyState" || message.type === "gameStarted") &&
      Array.isArray(message.players) &&
      typeof message.slug === "string" &&
      typeof message.hostId === "string" &&
      typeof message.selfId === "string" &&
      typeof message.asteroidNames === "object" &&
      message.asteroidNames &&
      typeof message.settings === "object" &&
      message.settings
    ) {
      return {
        type: message.type,
        slug: message.slug,
        hostId: message.hostId,
        selfId: message.selfId,
        players: message.players,
        asteroidNames: message.asteroidNames,
        settings: sanitizeRoomSettings(message.settings)
      } as ServerLobbyMessage
    }

    if (message.type === "playerState" && typeof message.playerId === "string" && typeof message.ship === "object") {
      return {
        type: "playerState",
        playerId: message.playerId,
        ship: message.ship as NetworkPlayerShip
      }
    }

    if (message.type === "playerDestroyed" && typeof message.playerId === "string" && typeof message.ship === "object") {
      return {
        type: "playerDestroyed",
        playerId: message.playerId,
        ship: message.ship as NetworkPlayerShip
      }
    }

    if (
      message.type === "projectileFired" &&
      typeof message.playerId === "string" &&
      typeof message.projectile === "object" &&
      message.projectile
    ) {
      return {
        type: "projectileFired",
        playerId: message.playerId,
        projectile: message.projectile as Projectile
      }
    }

    if (message.type === "asteroidState" && Array.isArray(message.asteroids)) {
      return {
        type: "asteroidState",
        asteroids: message.asteroids as Asteroid[]
      }
    }

    if (message.type === "powerUpState" && Array.isArray(message.powerUps)) {
      return {
        type: "powerUpState",
        powerUps: message.powerUps
      } as ServerLobbyMessage
    }

    if (
      message.type === "bossState" &&
      typeof message.preSpawnActive === "boolean" &&
      typeof message.nextBossWindowAt === "number" &&
      typeof message.bossIntervalMs === "number"
    ) {
      return {
        type: "bossState",
        boss: typeof message.boss === "object" && message.boss ? message.boss as BossAsteroid : undefined,
        preSpawnActive: message.preSpawnActive,
        nextBossWindowAt: message.nextBossWindowAt,
        bossIntervalMs: message.bossIntervalMs
      }
    }

    if (message.type === "asteroidDestroyed" && typeof message.asteroid === "object" && message.asteroid) {
      return {
        type: "asteroidDestroyed",
        asteroid: message.asteroid
      } as ServerLobbyMessage
    }

    if (
      message.type === "powerUpCollected" &&
      typeof message.playerId === "string" &&
      typeof message.powerUp === "object" &&
      message.powerUp &&
      typeof message.effectExpiresAt === "number"
    ) {
      return {
        type: "powerUpCollected",
        playerId: message.playerId,
        powerUp: message.powerUp,
        effectExpiresAt: message.effectExpiresAt
      } as ServerLobbyMessage
    }

    if (
      message.type === "bossHit" &&
      typeof message.playerId === "string" &&
      typeof message.scoreDelta === "number" &&
      typeof message.boss === "object" &&
      message.boss
    ) {
      return {
        type: "bossHit",
        boss: message.boss as BossAsteroid,
        playerId: message.playerId,
        scoreDelta: message.scoreDelta
      }
    }

    if (
      message.type === "bossDefeated" &&
      typeof message.scoreDelta === "number" &&
      typeof message.boss === "object" &&
      message.boss
    ) {
      return {
        type: "bossDefeated",
        boss: message.boss as BossAsteroid,
        scoreDelta: message.scoreDelta
      }
    }

    if (message.type === "powerUpEffectState" && Array.isArray(message.effects)) {
      return {
        type: "powerUpEffectState",
        effects: message.effects
      } as ServerLobbyMessage
    }

    if (message.type === "scoreState" && typeof message.scores === "object" && message.scores) {
      return {
        type: "scoreState",
        scores: message.scores
      } as ServerLobbyMessage
    }

    if (message.type === "lifeState" && typeof message.lives === "object" && message.lives) {
      return {
        type: "lifeState",
        lives: message.lives
      } as ServerLobbyMessage
    }

    if (
      message.type === "gameOver" &&
      typeof message.scores === "object" &&
      message.scores &&
      typeof message.lives === "object" &&
      message.lives &&
      typeof message.asteroidStats === "object" &&
      message.asteroidStats &&
      typeof message.recap === "object" &&
      message.recap
    ) {
      return {
        type: "gameOver",
        scores: message.scores,
        lives: message.lives,
        asteroidStats: message.asteroidStats,
        recap: message.recap
      } as ServerLobbyMessage
    }

    return undefined
  } catch {
    return undefined
  }
}

export const createLobbyConnection = ({
  onUsernameAccepted,
  onUsernameRejected,
  onLobbyList,
  onLobbyCreated,
  onLobbyNotFound,
  onLobbyJoinRejected,
  onState,
  onGameStarted,
  onPlayerState,
  onPlayerDestroyed,
  onProjectileFired,
  onAsteroidState,
  onAsteroidDestroyed,
  onPowerUpState,
  onBossState,
  onBossHit,
  onBossDefeated,
  onPowerUpCollected,
  onPowerUpEffectState,
  onScoreState,
  onLifeState,
  onGameOver,
  onStatus
}: CreateLobbyConnectionArgs) => {
  onStatus("connecting")

  const socket = new WebSocket(createSocketUrl())

  socket.addEventListener("open", () => {
    onStatus("connected")
  })

  socket.addEventListener("close", () => {
    onStatus("disconnected")
  })

  socket.addEventListener("message", (event) => {
    const message = parseServerMessage(event.data)

    if (message?.type === "usernameAccepted") {
      onUsernameAccepted(message)
      return
    }

    if (message?.type === "usernameRejected") {
      onUsernameRejected(message)
      return
    }

    if (message?.type === "lobbyList") {
      onLobbyList(message)
      return
    }

    if (message?.type === "lobbyCreated") {
      onLobbyCreated(message)
      return
    }

    if (message?.type === "lobbyNotFound") {
      onLobbyNotFound(message)
      return
    }

    if (message?.type === "lobbyJoinRejected") {
      onLobbyJoinRejected(message)
      return
    }

    if (message?.type === "gameStarted") {
      onGameStarted(message)
      return
    }

    if (message?.type === "lobbyState") {
      onState(message)
      return
    }

    if (message?.type === "playerState") {
      onPlayerState(message)
      return
    }

    if (message?.type === "playerDestroyed") {
      onPlayerDestroyed(message)
      return
    }

    if (message?.type === "projectileFired") {
      onProjectileFired(message)
      return
    }

    if (message?.type === "asteroidState") {
      onAsteroidState(message)
      return
    }

    if (message?.type === "asteroidDestroyed") {
      onAsteroidDestroyed(message)
      return
    }

    if (message?.type === "powerUpState") {
      onPowerUpState(message)
      return
    }

    if (message?.type === "bossState") {
      onBossState(message)
      return
    }

    if (message?.type === "bossHit") {
      onBossHit(message)
      return
    }

    if (message?.type === "bossDefeated") {
      onBossDefeated(message)
      return
    }

    if (message?.type === "powerUpCollected") {
      onPowerUpCollected(message)
      return
    }

    if (message?.type === "powerUpEffectState") {
      onPowerUpEffectState(message)
      return
    }

    if (message?.type === "scoreState") {
      onScoreState(message)
      return
    }

    if (message?.type === "lifeState") {
      onLifeState(message)
      return
    }

    if (message?.type === "gameOver") {
      onGameOver(message)
    }
  })

  return {
    setUsername: (username: string) => {
      const message: ClientLobbyMessage = {
        type: "setUsername",
        username
      }

      socket.send(JSON.stringify(message))
    },
    rename: (username: string) => {
      const message: ClientLobbyMessage = {
        type: "renamePlayer",
        username
      }

      socket.send(JSON.stringify(message))
    },
    createLobby: (asteroidNames?: AsteroidNamePools) => {
      const message: ClientLobbyMessage = {
        type: "createLobby",
        asteroidNames
      }

      socket.send(JSON.stringify(message))
    },
    join: (slug: string, asteroidNames?: AsteroidNamePools) => {
      const message: ClientLobbyMessage = {
        type: "joinLobby",
        slug,
        asteroidNames
      }

      socket.send(JSON.stringify(message))
    },
    leaveLobby: () => {
      const message: ClientLobbyMessage = {
        type: "leaveLobby"
      }

      socket.send(JSON.stringify(message))
    },
    listLobbies: () => {
      const message: ClientLobbyMessage = {
        type: "listLobbies"
      }

      socket.send(JSON.stringify(message))
    },
    sendAsteroidHit: (asteroidId: string) => {
      const message: ClientLobbyMessage = {
        type: "asteroidHit",
        asteroidId
      }

      socket.send(JSON.stringify(message))
    },
    sendPowerUpHit: (powerUpId: string) => {
      const message: ClientLobbyMessage = {
        type: "powerUpHit",
        powerUpId
      }

      socket.send(JSON.stringify(message))
    },
    sendBossHit: (bossId: string) => {
      const message: ClientLobbyMessage = {
        type: "bossHit",
        bossId
      }

      socket.send(JSON.stringify(message))
    },
    sendPlayerState: (ship: NetworkPlayerShip) => {
      const message: ClientLobbyMessage = {
        type: "playerState",
        ship
      }

      socket.send(JSON.stringify(message))
    },
    sendProjectileFired: (projectile: Projectile) => {
      const message: ClientLobbyMessage = {
        type: "projectileFired",
        projectile
      }

      socket.send(JSON.stringify(message))
    },
    sendPlayerHit: (ship: NetworkPlayerShip, cause: PlayerDeathCause = "unknown") => {
      const message: ClientLobbyMessage = {
        type: "playerHit",
        ship,
        cause
      }

      socket.send(JSON.stringify(message))
    },
    setAsteroidNames: (asteroidNames: AsteroidNamePools) => {
      const message: ClientLobbyMessage = {
        type: "setAsteroidNames",
        asteroidNames
      }

      socket.send(JSON.stringify(message))
    },
    setRoomSettings: (settings: RoomSettings) => {
      const message: ClientLobbyMessage = {
        type: "setRoomSettings",
        settings
      }

      socket.send(JSON.stringify(message))
    },
    startGame: () => {
      const message: ClientLobbyMessage = {
        type: "startGame"
      }

      socket.send(JSON.stringify(message))
    },
    destroy: () => {
      socket.close()
    }
  }
}
