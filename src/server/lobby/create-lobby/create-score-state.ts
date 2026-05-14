import type { LobbyPlayer, ScoreState } from "../../../shared/lobby-types"

export const createScoreState = (
  players: LobbyPlayer[],
  scoresByClientId: Map<string, number>
): ScoreState => {
  const scoredPlayers = players
    .map((player) => ({
      ...player,
      score: scoresByClientId.get(player.id) ?? 0
    }))
    .sort((left, right) => right.score - left.score || left.username.localeCompare(right.username))

  return {
    teamScore: scoredPlayers.reduce((total, player) => total + player.score, 0),
    players: scoredPlayers
  }
}
