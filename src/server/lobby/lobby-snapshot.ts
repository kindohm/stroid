import type { AsteroidNamePools } from "../../shared/lobby-types"
import type { RoomSettings } from "../../shared/room-settings"

export type LobbySnapshot = {
  slug: string
  hostSessionId: string
  hostUsername: string
  asteroidNames: AsteroidNamePools
  settings: RoomSettings
  createdAt: number
  updatedAt: number
}

export type LobbyStore = {
  delete: (slug: string) => Promise<void>
  loadAll: () => Promise<LobbySnapshot[]>
  save: (snapshot: LobbySnapshot) => Promise<void>
}
