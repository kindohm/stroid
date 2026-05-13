import type { LifeState, LobbyPlayer } from "../../shared/lobby-types"
import { isPlayerEliminated } from "./player-life"

export const isRenderPlayerVisible = (
  player: LobbyPlayer,
  selfId: string,
  localShipStatus: "alive" | "destroyed" | "eliminated",
  lives: LifeState | undefined,
  hiddenPlayerIds: Set<string>
) => {
  if (isPlayerEliminated(lives, player.id)) {
    return false
  }

  if (player.id === selfId) {
    return localShipStatus === "alive"
  }

  return !hiddenPlayerIds.has(player.id)
}
