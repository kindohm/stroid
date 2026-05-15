import type { WebSocket } from "ws"
import type { PlayerStats } from "../../shared/player-stats"

export type LobbyClient = {
  id: string
  socket: WebSocket
  isReady?: boolean
  username?: string
  sessionId?: string
  stats?: PlayerStats
}
