import type { LifeState, LobbyPlayer } from "../../../shared/lobby-types"

export const createLifeState = (
  players: LobbyPlayer[],
  livesByClientId: Map<string, number>,
  startingLives: number
): LifeState => ({
  players: players.map((player) => {
    const lives = livesByClientId.get(player.id) ?? startingLives

    return {
      ...player,
      lives,
      isEliminated: lives <= 0
    }
  })
})
