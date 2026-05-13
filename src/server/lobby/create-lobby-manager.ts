import { randomUUID } from "node:crypto"
import type { WebSocket } from "ws"
import type { AsteroidNamePools, ClientLobbyMessage } from "../../shared/lobby-types"
import { createLobby } from "./create-lobby"
import { createReadableLobbySlug } from "./create-readable-lobby-slug"
import type { LobbyClient } from "./lobby-client"
import { parseClientMessage } from "./parse-client-message"
import { sendMessage } from "./send-message"

export const createLobbyManager = () => {
  const clients = new Map<string, LobbyClient>()
  const lobbies = new Map<string, ReturnType<typeof createLobby>>()
  const clientLobbySlug = new Map<string, string>()

  const sendLobbyList = (client: LobbyClient) => {
    if (!client.username) {
      return
    }

    sendMessage(client, {
      type: "lobbyList",
      lobbies: [...lobbies.values()].map((lobby) => lobby.getSummary())
    })
  }

  const broadcastLobbyList = () => {
    clients.forEach(sendLobbyList)
  }

  const leaveLobby = (client: LobbyClient) => {
    const slug = clientLobbySlug.get(client.id)
    const lobby = slug ? lobbies.get(slug) : undefined

    if (!slug || !lobby) {
      return
    }

    clientLobbySlug.delete(client.id)
    lobby.removeClient(client)
  }

  const deleteLobby = (slug: string) => {
    lobbies.delete(slug)
    broadcastLobbyList()
  }

  const createRoom = (client: LobbyClient, asteroidNames?: AsteroidNamePools) => {
    if (!client.username) {
      sendMessage(client, {
        type: "lobbyJoinRejected",
        reason: "missingUsername"
      })
      return
    }

    leaveLobby(client)

    const slug = createReadableLobbySlug((nextSlug) => lobbies.has(nextSlug))
    const lobby = createLobby({
      hostId: client.id,
      slug,
      onChanged: broadcastLobbyList,
      onEmpty: deleteLobby
    })

    lobbies.set(slug, lobby)
    clientLobbySlug.set(client.id, slug)
    lobby.addClient(client, asteroidNames)
    sendMessage(client, {
      type: "lobbyCreated",
      lobby: lobby.getSummary()
    })
    broadcastLobbyList()
  }

  const joinRoom = (client: LobbyClient, slug: string, asteroidNames?: AsteroidNamePools) => {
    if (!client.username) {
      sendMessage(client, {
        type: "lobbyJoinRejected",
        reason: "missingUsername"
      })
      return
    }

    const lobby = lobbies.get(slug)

    if (!lobby) {
      sendMessage(client, {
        type: "lobbyNotFound",
        slug
      })
      sendMessage(client, {
        type: "lobbyJoinRejected",
        reason: "notFound"
      })
      return
    }

    if (!lobby.isJoinable()) {
      sendMessage(client, {
        type: "lobbyJoinRejected",
        reason: "gameInProgress"
      })
      return
    }

    leaveLobby(client)
    clientLobbySlug.set(client.id, slug)
    lobby.addClient(client, asteroidNames)
    broadcastLobbyList()
  }

  const handleMessage = (client: LobbyClient, message: ClientLobbyMessage) => {
    if (message.type === "setUsername") {
      if (message.username.length === 0) {
        sendMessage(client, {
          type: "usernameRejected",
          reason: "blank"
        })
        return
      }

      client.username = message.username
      sendMessage(client, {
        type: "usernameAccepted",
        username: message.username
      })
      sendLobbyList(client)
      return
    }

    if (message.type === "listLobbies") {
      sendLobbyList(client)
      return
    }

    if (message.type === "createLobby") {
      createRoom(client, message.asteroidNames)
      return
    }

    if (message.type === "joinLobby") {
      joinRoom(client, message.slug, message.asteroidNames)
      return
    }

    if (message.type === "leaveLobby") {
      leaveLobby(client)
      sendLobbyList(client)
      return
    }

    const slug = clientLobbySlug.get(client.id)
    const lobby = slug ? lobbies.get(slug) : undefined

    lobby?.handleMessage(client, message)
  }

  const addClient = (socket: WebSocket) => {
    const client: LobbyClient = {
      id: randomUUID(),
      socket
    }

    clients.set(client.id, client)

    socket.on("message", (data) => {
      const message = parseClientMessage(data)

      if (message) {
        handleMessage(client, message)
      }
    })

    socket.on("close", () => {
      leaveLobby(client)
      clients.delete(client.id)
      broadcastLobbyList()
    })
  }

  return {
    addClient,
    getLobbySummaries: () => [...lobbies.values()].map((lobby) => lobby.getSummary()),
    stop: () => {
      lobbies.forEach((lobby) => lobby.stop())
    }
  }
}
