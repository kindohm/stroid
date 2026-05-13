import type { Asteroid } from "./game-types"

export type LobbyPlayer = {
  id: string
  username: string
  color: string
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

export type ServerLobbyMessage =
  | {
      type: "lobbyState"
      selfId: string
      players: LobbyPlayer[]
    }
  | {
      type: "gameStarted"
      selfId: string
      players: LobbyPlayer[]
    }
  | {
      type: "playerState"
      playerId: string
      ship: NetworkPlayerShip
    }
  | {
      type: "asteroidState"
      asteroids: Asteroid[]
    }
