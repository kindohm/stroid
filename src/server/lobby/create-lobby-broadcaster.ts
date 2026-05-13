import type { ServerLobbyMessage } from "../../shared/lobby-types"
import type { LobbyClient } from "./lobby-client"
import { sendMessage } from "./send-message"

type CreateLobbyBroadcasterArgs = {
  clients: Map<string, LobbyClient>
}

export const createLobbyBroadcaster = ({ clients }: CreateLobbyBroadcasterArgs) => {
  const sendToJoined = (message: ServerLobbyMessage) => {
    clients.forEach((client) => {
      if (client.username) {
        sendMessage(client, message)
      }
    })
  }

  const sendToJoinedExcept = (message: ServerLobbyMessage, excludedClientId: string) => {
    clients.forEach((client) => {
      if (client.id !== excludedClientId && client.username) {
        sendMessage(client, message)
      }
    })
  }

  return {
    sendToJoined,
    sendToJoinedExcept
  }
}
