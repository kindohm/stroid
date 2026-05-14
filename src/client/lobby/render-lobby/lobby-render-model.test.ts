import { describe, expect, it } from "vitest"
import { defaultRoomSettings } from "../../../shared/room-settings"
import { defaultAsteroidNames } from "../asteroid-name-options"
import { createLobbyRenderModel } from "./lobby-render-model"

describe("createLobbyRenderModel", () => {
  it("starts at username view without a saved username", () => {
    expect(createLobbyRenderModel("", undefined)).toEqual({
      asteroidNames: defaultAsteroidNames,
      roomSettings: defaultRoomSettings,
      connectionStatus: "connecting",
      selfId: "",
      lobbyPlayers: [],
      lobbies: [],
      pendingSlug: undefined,
      view: "username",
      statusMessage: "choose signal"
    })
  })

  it("keeps a direct lobby slug pending until username is accepted", () => {
    const model = createLobbyRenderModel("mike", "orbit-room")

    expect(model.view).toBe("browser")
    expect(model.pendingSlug).toBe("orbit-room")
    expect(model.statusMessage).toBe("join orbit-room")
  })
})
