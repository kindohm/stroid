import type { ActivePowerUpEffect, Asteroid, AsteroidSize, BossAsteroid, PowerUp, Projectile, Vector } from "./game-types"
import type { PlayerStats } from "./player-stats"
import type { RoomSettings } from "./room-settings"

export type LobbyPlayer = {
  id: string
  username: string
  color: string
  isReady?: boolean
  stats?: PlayerStats
}

export type LobbySummary = {
  slug: string
  hostId: string
  hostUsername: string
  playerCount: number
  gameInProgress: boolean
}

export type AsteroidNameSize = "extraLarge" | "large" | "medium" | "small" | "boss"
export type RegularAsteroidNameSize = Exclude<AsteroidNameSize, "boss">

export type AsteroidNamePools = Record<AsteroidNameSize, string[]>

export type PlayerScore = LobbyPlayer & {
  score: number
}

export type ScoreState = {
  teamScore: number
  players: PlayerScore[]
}

export type PlayerLife = LobbyPlayer & {
  lives: number
  isEliminated: boolean
  ghostPosition?: Vector
}

export type PlayerDeathCause = "asteroid" | "friendlyProjectile" | "shipCollision" | "unknown"

export type LifeState = {
  players: PlayerLife[]
}

export type PlayerAsteroidStats = LobbyPlayer & {
  destroyedBySize: Record<RegularAsteroidNameSize, number>
  destroyedNamesBySize: Record<RegularAsteroidNameSize, Record<string, number>>
}

export type AsteroidStatsState = {
  players: PlayerAsteroidStats[]
}

export type GameRecapEvent =
  | {
      type: "gameStarted"
      elapsedSeconds: number
      label: string
    }
  | {
      type: "asteroidDestroyed"
      elapsedSeconds: number
      player: LobbyPlayer
      asteroidName: string
      asteroidSize: AsteroidNameSize
      scoreDelta: number
    }
  | {
      type: "powerUpCollected"
      elapsedSeconds: number
      player: LobbyPlayer
      powerUpType: PowerUp["type"]
    }
  | {
      type: "playerDestroyed"
      elapsedSeconds: number
      player: LobbyPlayer
      cause: PlayerDeathCause
      livesRemaining: number
    }
  | {
      type: "gameOver"
      elapsedSeconds: number
      label: string
    }

export type GameRecapHighlights = {
  firstPlayerHit?: Extract<GameRecapEvent, { type: "playerDestroyed" }>
  finalAsteroidDestroyed?: Extract<GameRecapEvent, { type: "asteroidDestroyed" }>
  biggestScoreStreak?: {
    player: LobbyPlayer
    score: number
    asteroidCount: number
    startedAt: number
    endedAt: number
  }
  finalTenSeconds: GameRecapEvent[]
}

export type GameRecap = {
  events: GameRecapEvent[]
  highlights: GameRecapHighlights
}

export type NetworkPlayerShip = {
  position: {
    x: number
    y: number
  }
  velocity: {
    x: number
    y: number
  }
  angle: number
  isThrusting: boolean
}

export type ClientLobbyMessage =
  | {
      type: "setUsername"
      username: string
      sessionId?: string
      stats?: PlayerStats
    }
  | {
      type: "createLobby"
      asteroidNames?: AsteroidNamePools
    }
  | {
      type: "joinLobby"
      slug: string
      asteroidNames?: AsteroidNamePools
    }
  | {
      type: "leaveLobby"
    }
  | {
      type: "listLobbies"
    }
  | {
      type: "renamePlayer"
      username: string
      asteroidNames?: AsteroidNamePools
      stats?: PlayerStats
    }
  | {
      type: "setPlayerStats"
      stats: PlayerStats
    }
  | {
      type: "setAsteroidNames"
      asteroidNames: AsteroidNamePools
    }
  | {
      type: "setRoomSettings"
      settings: RoomSettings
    }
  | {
      type: "setReady"
      isReady: boolean
    }
  | {
      type: "startGame"
    }
  | {
      type: "playerState"
      ship: NetworkPlayerShip
    }
  | {
      type: "asteroidHit"
      asteroidId: string
    }
  | {
      type: "powerUpHit"
      powerUpId: string
    }
  | {
      type: "bossHit"
      bossId: string
    }
  | {
      type: "playerHit"
      ship: NetworkPlayerShip
      cause?: PlayerDeathCause
    }
  | {
      type: "revivePlayer"
      playerId: string
    }
  | {
      type: "projectileFired"
      projectile: Projectile
    }

export type ServerLobbyMessage =
  | {
      type: "usernameAccepted"
      username: string
    }
  | {
      type: "usernameRejected"
      reason: "blank"
    }
  | {
      type: "lobbyList"
      lobbies: LobbySummary[]
    }
  | {
      type: "lobbyCreated"
      lobby: LobbySummary
    }
  | {
      type: "lobbyNotFound"
      slug: string
    }
  | {
      type: "lobbyJoinRejected"
      reason: "notFound" | "missingUsername"
    }
  | {
      type: "lobbyState"
      slug: string
      hostId: string
      selfId: string
      players: LobbyPlayer[]
      asteroidNames: AsteroidNamePools
      settings: RoomSettings
    }
  | {
      type: "gameStarted"
      slug: string
      hostId: string
      selfId: string
      players: LobbyPlayer[]
      asteroidNames: AsteroidNamePools
      settings: RoomSettings
      isSpectator?: boolean
    }
  | {
      type: "playerState"
      playerId: string
      ship: NetworkPlayerShip
    }
  | {
      type: "playerDestroyed"
      playerId: string
      ship: NetworkPlayerShip
    }
  | {
      type: "projectileFired"
      playerId: string
      projectile: Projectile
    }
  | {
      type: "asteroidState"
      asteroids: Asteroid[]
    }
  | {
      type: "powerUpState"
      powerUps: PowerUp[]
    }
  | {
      type: "bossState"
      boss?: BossAsteroid
      preSpawnActive: boolean
      nextBossWindowAt: number
      bossIntervalMs: number
    }
  | {
      type: "asteroidDestroyed"
      asteroid: {
        id: string
        position: Vector
        radius: number
        size: AsteroidSize
      }
    }
  | {
      type: "powerUpCollected"
      playerId: string
      powerUp: PowerUp
      effectExpiresAt: number
    }
  | {
      type: "bossHit"
      boss: BossAsteroid
      playerId: string
      scoreDelta: number
    }
  | {
      type: "bossDefeated"
      boss: BossAsteroid
      scoreDelta: number
    }
  | {
      type: "powerUpEffectState"
      effects: ActivePowerUpEffect[]
    }
  | {
      type: "scoreState"
      scores: ScoreState
    }
  | {
      type: "lifeState"
      lives: LifeState
    }
  | {
      type: "gameOver"
      scores: ScoreState
      lives: LifeState
      asteroidStats: AsteroidStatsState
      recap: GameRecap
    }
