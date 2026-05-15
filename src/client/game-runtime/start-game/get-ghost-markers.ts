import type { LifeState } from "../../../shared/lobby-types"
import type { RenderGhostMarker } from "../../render/render-game"

export const getGhostMarkers = (lives: LifeState | undefined): RenderGhostMarker[] =>
  (lives?.players ?? [])
    .filter((player) => player.isEliminated && player.ghostPosition)
    .map((player) => ({
      username: player.username,
      position: player.ghostPosition ?? { x: 0, y: 0 },
      color: player.color
    }))
