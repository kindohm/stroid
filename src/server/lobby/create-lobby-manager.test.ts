import { describe, expect, it } from "vitest"
import { createLobbyManager } from "./create-lobby-manager"
import { createSocket } from "./create-socket-stub.test-helper"

describe("createLobbyManager", () => {
  it("requires username before creating a lobby", () => {
    const manager = createLobbyManager()
    const socket = createSocket()

    manager.addClient(socket as never)
    socket.listeners.get("message")?.(JSON.stringify({ type: "createLobby" }))

    const rejection = socket.sent
      .map((message) => JSON.parse(message) as { type: string; reason?: string })
      .find((message) => message.type === "lobbyJoinRejected")

    expect(rejection?.reason).toBe("missingUsername")
    expect(manager.getLobbySummaries()).toEqual([])
  })

  it("creates human readable lobbies after username is accepted", () => {
    const manager = createLobbyManager()
    const socket = createSocket()

    manager.addClient(socket as never)
    socket.listeners.get("message")?.(JSON.stringify({ type: "setUsername", username: "mike" }))
    socket.listeners.get("message")?.(JSON.stringify({ type: "createLobby" }))

    const created = socket.sent
      .map((message) => JSON.parse(message) as { type: string; lobby?: { slug: string; hostUsername: string } })
      .find((message) => message.type === "lobbyCreated")

    expect(created?.lobby?.slug).toMatch(/^[a-z]+-[a-z]+-\d{3}$/)
    expect(created?.lobby?.hostUsername).toBe("mike")
  })

  it("only lets the host start the game", () => {
    const manager = createLobbyManager()
    const host = createSocket()
    const guest = createSocket()

    manager.addClient(host as never)
    manager.addClient(guest as never)
    host.listeners.get("message")?.(JSON.stringify({ type: "setUsername", username: "mike" }))
    guest.listeners.get("message")?.(JSON.stringify({ type: "setUsername", username: "zoe" }))
    host.listeners.get("message")?.(JSON.stringify({ type: "createLobby" }))
    const slug = manager.getLobbySummaries()[0]?.slug

    expect(slug).toBeDefined()

    guest.listeners.get("message")?.(JSON.stringify({ type: "joinLobby", slug }))
    guest.listeners.get("message")?.(JSON.stringify({ type: "startGame" }))

    const guestStarted = guest.sent
      .map((message) => JSON.parse(message) as { type: string })
      .find((message) => message.type === "gameStarted")

    expect(guestStarted).toBeUndefined()

    host.listeners.get("message")?.(JSON.stringify({ type: "startGame" }))

    const hostStarted = host.sent
      .map((message) => JSON.parse(message) as { type: string })
      .find((message) => message.type === "gameStarted")
    const secondGuestStarted = guest.sent
      .map((message) => JSON.parse(message) as { type: string })
      .find((message) => message.type === "gameStarted")

    expect(hostStarted?.type).toBe("gameStarted")
    expect(secondGuestStarted?.type).toBe("gameStarted")
    manager.stop()
  })

  it("scopes game messages to their lobby", () => {
    const manager = createLobbyManager()
    const firstHost = createSocket()
    const firstGuest = createSocket()
    const secondHost = createSocket()

    manager.addClient(firstHost as never)
    manager.addClient(firstGuest as never)
    manager.addClient(secondHost as never)
    firstHost.listeners.get("message")?.(JSON.stringify({ type: "setUsername", username: "mike" }))
    firstGuest.listeners.get("message")?.(JSON.stringify({ type: "setUsername", username: "zoe" }))
    secondHost.listeners.get("message")?.(JSON.stringify({ type: "setUsername", username: "avi" }))
    firstHost.listeners.get("message")?.(JSON.stringify({ type: "createLobby" }))
    const firstSlug = manager.getLobbySummaries()[0]?.slug
    secondHost.listeners.get("message")?.(JSON.stringify({ type: "createLobby" }))
    firstGuest.listeners.get("message")?.(JSON.stringify({ type: "joinLobby", slug: firstSlug }))
    firstHost.listeners.get("message")?.(JSON.stringify({ type: "startGame" }))
    secondHost.listeners.get("message")?.(JSON.stringify({ type: "startGame" }))
    firstHost.listeners.get("message")?.(JSON.stringify({
      type: "projectileFired",
      projectile: {
        id: "mike-1",
        owner: "mike",
        color: "#74ffe0",
        position: { x: 10, y: 12 },
        velocity: { x: 100, y: 0 },
        ttlSeconds: 1.8
      }
    }))

    const relayedToGuest = firstGuest.sent
      .map((message) => JSON.parse(message) as { type: string; projectile?: { id: string } })
      .find((message) => message.type === "projectileFired")
    const relayedToOtherLobby = secondHost.sent
      .map((message) => JSON.parse(message) as { type: string; projectile?: { id: string } })
      .find((message) => message.type === "projectileFired")

    expect(relayedToGuest?.projectile?.id).toBe("mike-1")
    expect(relayedToOtherLobby).toBeUndefined()
    manager.stop()
  })

  it("removes empty lobbies and rejects joining games in progress", () => {
    const manager = createLobbyManager()
    const host = createSocket()
    const guest = createSocket()
    const late = createSocket()

    manager.addClient(host as never)
    manager.addClient(guest as never)
    manager.addClient(late as never)
    host.listeners.get("message")?.(JSON.stringify({ type: "setUsername", username: "mike" }))
    guest.listeners.get("message")?.(JSON.stringify({ type: "setUsername", username: "zoe" }))
    late.listeners.get("message")?.(JSON.stringify({ type: "setUsername", username: "kim" }))
    host.listeners.get("message")?.(JSON.stringify({ type: "createLobby" }))
    const slug = manager.getLobbySummaries()[0]?.slug

    guest.listeners.get("message")?.(JSON.stringify({ type: "joinLobby", slug }))
    host.listeners.get("message")?.(JSON.stringify({ type: "startGame" }))
    late.listeners.get("message")?.(JSON.stringify({ type: "joinLobby", slug }))

    const rejection = late.sent
      .map((message) => JSON.parse(message) as { type: string; reason?: string })
      .find((message) => message.type === "lobbyJoinRejected")

    expect(rejection?.reason).toBe("gameInProgress")

    host.listeners.get("close")?.()
    guest.listeners.get("close")?.()

    expect(manager.getLobbySummaries()).toEqual([])
    manager.stop()
  })
})
