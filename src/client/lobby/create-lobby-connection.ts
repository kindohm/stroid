import type { Asteroid, Projectile } from "../../shared/game-types"
import type { AsteroidNamePools, ClientLobbyMessage, NetworkPlayerShip, ServerLobbyMessage } from "../../shared/lobby-types"

type CreateLobbyConnectionArgs = {
  onState: (message: Extract<ServerLobbyMessage, { type: "lobbyState" }>) => void
  onGameStarted: (message: Extract<ServerLobbyMessage, { type: "gameStarted" }>) => void
  onPlayerState: (message: Extract<ServerLobbyMessage, { type: "playerState" }>) => void
  onProjectileFired: (message: Extract<ServerLobbyMessage, { type: "projectileFired" }>) => void
  onAsteroidState: (message: Extract<ServerLobbyMessage, { type: "asteroidState" }>) => void
  onScoreState: (message: Extract<ServerLobbyMessage, { type: "scoreState" }>) => void
  onLifeState: (message: Extract<ServerLobbyMessage, { type: "lifeState" }>) => void
  onGameOver: (message: Extract<ServerLobbyMessage, { type: "gameOver" }>) => void
  onStatus: (status: "connected" | "connecting" | "disconnected") => void
}

const createSocketUrl = () => {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"

  return `${protocol}//${window.location.host}/ws`
}

const parseServerMessage = (data: MessageEvent["data"]): ServerLobbyMessage | undefined => {
  try {
    const message = JSON.parse(String(data)) as Partial<ServerLobbyMessage>

    if (
      (message.type === "lobbyState" || message.type === "gameStarted") &&
      Array.isArray(message.players) &&
      typeof message.selfId === "string" &&
      typeof message.asteroidNames === "object" &&
      message.asteroidNames
    ) {
      return {
        type: message.type,
        selfId: message.selfId,
        players: message.players,
        asteroidNames: message.asteroidNames
      } as ServerLobbyMessage
    }

    if (message.type === "playerState" && typeof message.playerId === "string" && typeof message.ship === "object") {
      return {
        type: "playerState",
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
      message.asteroidStats
    ) {
      return {
        type: "gameOver",
        scores: message.scores,
        lives: message.lives,
        asteroidStats: message.asteroidStats
      } as ServerLobbyMessage
    }

    return undefined
  } catch {
    return undefined
  }
}

export const createLobbyConnection = ({
  onState,
  onGameStarted,
  onPlayerState,
  onProjectileFired,
  onAsteroidState,
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

    if (message?.type === "projectileFired") {
      onProjectileFired(message)
      return
    }

    if (message?.type === "asteroidState") {
      onAsteroidState(message)
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
    join: (username: string) => {
      const message: ClientLobbyMessage = {
        type: "joinLobby",
        username
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
    sendPlayerHit: () => {
      const message: ClientLobbyMessage = {
        type: "playerHit"
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
