import type { AsteroidNamePools } from "../../../shared/lobby-types"
import type { RoomSettings } from "../../../shared/room-settings"

export type LobbyArgs = {
  hostId: string
  hostSessionId: string
  hostUsername: string
  slug: string
  asteroidNames: AsteroidNamePools
  settings: RoomSettings
  createdAt: number
  onChanged?: () => void
  onEmpty?: (slug: string) => void
}
