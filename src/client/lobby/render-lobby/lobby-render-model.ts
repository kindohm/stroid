import type { AsteroidNamePools, LobbyPlayer, LobbySummary } from "../../../shared/lobby-types"
import { defaultRoomSettings, type RoomSettings } from "../../../shared/room-settings"
import { defaultAsteroidNames } from "../asteroid-name-options"
import type { LobbyView } from "./lobby-view"

export type LobbyRenderModel = {
  asteroidNames: AsteroidNamePools
  roomSettings: RoomSettings
  connectionStatus: "connected" | "connecting" | "disconnected"
  selfId: string
  lobbyPlayers: LobbyPlayer[]
  lobbies: LobbySummary[]
  pendingSlug?: string
  view: LobbyView
  statusMessage: string
}

export const createLobbyRenderModel = (
  currentUsername: string,
  directSlug?: string
): LobbyRenderModel => ({
  asteroidNames: defaultAsteroidNames,
  roomSettings: defaultRoomSettings,
  connectionStatus: "connecting",
  selfId: "",
  lobbyPlayers: [],
  lobbies: [],
  pendingSlug: directSlug,
  view: currentUsername ? "browser" : "username",
  statusMessage: directSlug ? `join ${directSlug}` : "choose signal"
})
