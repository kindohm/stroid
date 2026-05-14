import type { WebSocket } from "ws"

export type LobbyClient = {
  id: string
  socket: WebSocket
  username?: string
  sessionId?: string
}
