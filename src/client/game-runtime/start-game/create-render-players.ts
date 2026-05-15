import type { NetworkPlayerShip } from "../../../shared/lobby-types"
import type { LifeState, LobbyPlayer } from "../../../shared/lobby-types"
import type { PlayerShip } from "../../../shared/game-types"
import type { RenderPlayerView } from "../../render/render-game"
import { isRenderPlayerVisible } from "../is-render-player-visible"
import type { LocalShipStatus } from "./local-ship-status"

type CreateRenderPlayersArgs = {
  followedPlayerId?: string
  hasShield: (playerId: string) => boolean
  hiddenPlayerIds: Set<string>
  inputThrust: boolean
  isSpectator: boolean
  lives?: LifeState
  localRenderShip: PlayerShip
  localShipStatus: LocalShipStatus
  now: number
  players: LobbyPlayer[]
  remoteTargets: Map<string, NetworkPlayerShip>
  selfId: string
  shipsByPlayerId: {
    get: (playerId: string) => PlayerShip | undefined
  }
  updatedLocalShip: PlayerShip
  invincibleUntil: number
}

export const createRenderPlayers = ({
  followedPlayerId,
  hasShield,
  hiddenPlayerIds,
  inputThrust,
  isSpectator,
  lives,
  localRenderShip,
  localShipStatus,
  now,
  players,
  remoteTargets,
  selfId,
  shipsByPlayerId,
  updatedLocalShip,
  invincibleUntil
}: CreateRenderPlayersArgs): RenderPlayerView[] =>
  players
    .filter((player) =>
      !(isSpectator && player.id === followedPlayerId) &&
      isRenderPlayerVisible(player, selfId, localShipStatus, lives, hiddenPlayerIds)
    )
    .map((player) => ({
      username: player.username,
      ship: player.id === selfId
        ? localRenderShip
        : shipsByPlayerId.get(player.id) ?? updatedLocalShip,
      color: player.color,
      isThrusting:
        player.id === selfId
          ? inputThrust
          : remoteTargets.get(player.id)?.isThrusting ?? false,
      isLocal: player.id === selfId,
      isInvincible: player.id === selfId
        ? localShipStatus === "alive" && (now < invincibleUntil || hasShield(player.id))
        : hasShield(player.id)
    }))
