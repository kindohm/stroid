import type { Vector } from "../../../shared/game-types"
import type { LifeState, LobbyPlayer } from "../../../shared/lobby-types"

export const createLifeState = (
  players: LobbyPlayer[],
  livesByClientId: Map<string, number>,
  startingLives: number,
  ghostPositionsByClientId: Map<string, Vector> = new Map()
): LifeState => ({
  players: players.map((player) => {
    const lives = livesByClientId.get(player.id) ?? startingLives
    const isEliminated = lives <= 0
    const ghostPosition = ghostPositionsByClientId.get(player.id)

    return {
      ...player,
      lives,
      isEliminated,
      ...(isEliminated && ghostPosition
        ? { ghostPosition }
        : {})
    }
  })
})
