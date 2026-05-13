import type { Asteroid, AsteroidSize, Projectile, Vector } from "./game-types"

export type LobbyPlayer = {
  id: string
  username: string
  color: string
}

export type LobbySummary = {
  slug: string
  hostId: string
  hostUsername: string
  playerCount: number
  gameInProgress: boolean
}

export type AsteroidNameSize = "extraLarge" | "large" | "medium" | "small"

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
}

export type LifeState = {
  players: PlayerLife[]
}

export type PlayerAsteroidStats = LobbyPlayer & {
  destroyedBySize: Record<AsteroidNameSize, number>
  destroyedNamesBySize: Record<AsteroidNameSize, Record<string, number>>
}

export type AsteroidStatsState = {
  players: PlayerAsteroidStats[]
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
    }
  | {
      type: "setAsteroidNames"
      asteroidNames: AsteroidNamePools
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
      type: "playerHit"
      ship: NetworkPlayerShip
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
      reason: "notFound" | "gameInProgress" | "missingUsername"
    }
  | {
      type: "lobbyState"
      slug: string
      hostId: string
      selfId: string
      players: LobbyPlayer[]
      asteroidNames: AsteroidNamePools
    }
  | {
      type: "gameStarted"
      slug: string
      hostId: string
      selfId: string
      players: LobbyPlayer[]
      asteroidNames: AsteroidNamePools
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
      type: "asteroidDestroyed"
      asteroid: {
        id: string
        position: Vector
        radius: number
        size: AsteroidSize
      }
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
    }
