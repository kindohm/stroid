import type { Asteroid, Projectile } from "./game-types"

export type LobbyPlayer = {
  id: string
  username: string
  color: string
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
      type: "joinLobby"
      username: string
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
    }
  | {
      type: "projectileFired"
      projectile: Projectile
    }

export type ServerLobbyMessage =
  | {
      type: "lobbyState"
      selfId: string
      players: LobbyPlayer[]
      asteroidNames: AsteroidNamePools
    }
  | {
      type: "gameStarted"
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
      type: "projectileFired"
      playerId: string
      projectile: Projectile
    }
  | {
      type: "asteroidState"
      asteroids: Asteroid[]
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
