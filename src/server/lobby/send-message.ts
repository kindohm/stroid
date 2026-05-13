import type { ServerLobbyMessage } from "../../shared/lobby-types"
import type { LobbyClient } from "./lobby-client"

export const sendMessage = (client: LobbyClient, message: ServerLobbyMessage) => {
  client.socket.send(JSON.stringify(message))
}
