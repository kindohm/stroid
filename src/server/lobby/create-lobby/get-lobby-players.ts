import { assignPlayerColor } from "../../../game/assign-player-color"
import type { LobbyPlayer } from "../../../shared/lobby-types"
import type { LobbyClient } from "../lobby-client"

export const getLobbyPlayers = (clients: Map<string, LobbyClient>): LobbyPlayer[] =>
  [...clients.values()]
    .filter((client) => typeof client.username === "string" && client.username.length > 0)
    .map((client) => ({
      id: client.id,
      username: client.username ?? "",
      color: assignPlayerColor(client.username ?? ""),
      isReady: client.isReady ?? false,
      stats: client.stats
    }))
