import { randomUUID } from "node:crypto"
import type { WebSocket } from "ws"
import type { AsteroidNamePools, ClientLobbyMessage } from "../../shared/lobby-types"
import { createLobby } from "./create-lobby/create-lobby"
import { createReadableLobbySlug } from "./create-readable-lobby-slug"
import type { LobbyClient } from "./lobby-client"
import type { LobbySnapshot, LobbyStore } from "./lobby-snapshot"
import { parseClientMessage } from "./parse-client-message"
import { sendMessage } from "./send-message"

type CreateLobbyManagerArgs = {
  emptyLobbyGraceMs?: number
  snapshots?: LobbySnapshot[]
  store?: LobbyStore
}

const defaultEmptyLobbyGraceMs = 30 * 60 * 1000

export const createLobbyManager = ({
  emptyLobbyGraceMs = defaultEmptyLobbyGraceMs,
  snapshots = [],
  store
}: CreateLobbyManagerArgs = {}) => {
  const clients = new Map<string, LobbyClient>()
  const lobbies = new Map<string, ReturnType<typeof createLobby>>()
  const clientLobbySlug = new Map<string, string>()
  const emptyLobbyTimers = new Map<string, ReturnType<typeof setTimeout>>()

  const deleteStoredLobby = (slug: string) => {
    store?.delete(slug).catch(() => undefined)
  }

  const persistLobby = (slug: string) => {
    const lobby = lobbies.get(slug)

    if (!lobby || !store) {
      return
    }

    if (!lobby.isJoinable()) {
      deleteStoredLobby(slug)
      return
    }

    store.save(lobby.getSnapshot()).catch(() => undefined)
  }

  const clearEmptyLobbyTimer = (slug: string) => {
    const timer = emptyLobbyTimers.get(slug)

    if (!timer) {
      return
    }

    clearTimeout(timer)
    emptyLobbyTimers.delete(slug)
  }

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
    clearEmptyLobbyTimer(slug)
    lobbies.delete(slug)
    deleteStoredLobby(slug)
    broadcastLobbyList()
  }

  const scheduleEmptyLobbyDelete = (slug: string) => {
    clearEmptyLobbyTimer(slug)
    persistLobby(slug)
    emptyLobbyTimers.set(slug, setTimeout(() => {
      deleteLobby(slug)
    }, emptyLobbyGraceMs))
    broadcastLobbyList()
  }

  const scheduleRestoredEmptyLobbyDelete = (snapshot: LobbySnapshot) => {
    const remainingGraceMs = Math.max(0, emptyLobbyGraceMs - (Date.now() - snapshot.updatedAt))

    if (remainingGraceMs === 0) {
      deleteLobby(snapshot.slug)
      return
    }

    emptyLobbyTimers.set(snapshot.slug, setTimeout(() => {
      deleteLobby(snapshot.slug)
    }, remainingGraceMs))
  }

  snapshots.forEach((snapshot) => {
    const lobby = createLobby({
      hostSessionId: snapshot.hostSessionId,
      hostUsername: snapshot.hostUsername,
      slug: snapshot.slug,
      asteroidNames: snapshot.asteroidNames,
      settings: snapshot.settings,
      createdAt: snapshot.createdAt,
      onChanged: () => {
        broadcastLobbyList()
        persistLobby(snapshot.slug)
      },
      onEmpty: scheduleEmptyLobbyDelete
    })

    lobbies.set(snapshot.slug, lobby)
    scheduleRestoredEmptyLobbyDelete(snapshot)
  })

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
      hostSessionId: client.sessionId ?? client.id,
      hostUsername: client.username,
      slug,
      onChanged: () => {
        broadcastLobbyList()
        persistLobby(slug)
      },
      onEmpty: scheduleEmptyLobbyDelete
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
    clearEmptyLobbyTimer(slug)
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
      client.sessionId = message.sessionId
      client.stats = message.stats
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
      emptyLobbyTimers.forEach((timer) => clearTimeout(timer))
      emptyLobbyTimers.clear()
      lobbies.forEach((lobby) => lobby.stop())
    }
  }
}
