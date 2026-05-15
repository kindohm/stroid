import type { LifeState, LobbyPlayer } from "../../../shared/lobby-types"
import { isPlayerEliminated } from "../player-life"

type ChooseFollowedPlayerIdArgs = {
  followedPlayerId?: string
  lives?: LifeState
  players: LobbyPlayer[]
  selfId: string
}

export const chooseFollowedPlayerId = ({
  followedPlayerId,
  lives,
  players,
  selfId
}: ChooseFollowedPlayerIdArgs) => {
  if (
    followedPlayerId &&
    players.some((player) => player.id === followedPlayerId && !isPlayerEliminated(lives, player.id))
  ) {
    return followedPlayerId
  }

  return players.find((player) => player.id !== selfId && !isPlayerEliminated(lives, player.id))?.id
}
