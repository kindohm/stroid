import type { Asteroid } from "../../shared/game-types"
import type { ClientLobbyMessage, NetworkPlayerShip, ServerLobbyMessage } from "../../shared/lobby-types"

type CreateLobbyConnectionArgs = {
  onState: (message: Extract<ServerLobbyMessage, { type: "lobbyState" }>) => void
  onGameStarted: (message: Extract<ServerLobbyMessage, { type: "gameStarted" }>) => void
  onPlayerState: (message: Extract<ServerLobbyMessage, { type: "playerState" }>) => void
  onAsteroidState: (message: Extract<ServerLobbyMessage, { type: "asteroidState" }>) => void
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
      typeof message.selfId === "string"
    ) {
      return {
        type: message.type,
        selfId: message.selfId,
        players: message.players
      } as ServerLobbyMessage
    }

    if (message.type === "playerState" && typeof message.playerId === "string" && typeof message.ship === "object") {
      return {
        type: "playerState",
        playerId: message.playerId,
        ship: message.ship as NetworkPlayerShip
      }
    }

    if (message.type === "asteroidState" && Array.isArray(message.asteroids)) {
      return {
        type: "asteroidState",
        asteroids: message.asteroids as Asteroid[]
      }
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
  onAsteroidState,
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

    if (message?.type === "asteroidState") {
      onAsteroidState(message)
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
