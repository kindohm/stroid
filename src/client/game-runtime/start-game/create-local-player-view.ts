import type { PlayerShip } from "../../../shared/game-types"
import type { LobbyPlayer } from "../../../shared/lobby-types"
import type { RenderPlayerView } from "../../render/render-game"
import type { LocalShipStatus } from "./local-ship-status"

type CreateLocalPlayerViewArgs = {
  canControlLocalShip: boolean
  followedPlayer?: LobbyPlayer
  followedShip?: PlayerShip
  hasShield: (playerId: string) => boolean
  inputThrust: boolean
  isSpectator: boolean
  localRenderShip: PlayerShip
  localShipStatus: LocalShipStatus
  now: number
  selfId: string
  selfPlayer: LobbyPlayer
  invincibleUntil: number
}

export const createLocalPlayerView = ({
  canControlLocalShip,
  followedPlayer,
  followedShip,
  hasShield,
  inputThrust,
  isSpectator,
  localRenderShip,
  localShipStatus,
  now,
  selfId,
  selfPlayer,
  invincibleUntil
}: CreateLocalPlayerViewArgs): RenderPlayerView => {
  if ((localShipStatus === "eliminated" || isSpectator) && followedPlayer && followedShip) {
    return {
      username: `${isSpectator ? "spectator" : "watching"} ${followedPlayer.username}`,
      ship: followedShip,
      color: followedPlayer.color,
      isThrusting: false,
      isLocal: true,
      isInvincible: false,
      isHidden: false
    }
  }

  return {
    username: selfPlayer.username,
    ship: localRenderShip,
    color: selfPlayer.color,
    isThrusting: canControlLocalShip && inputThrust,
    isLocal: true,
    isInvincible: localShipStatus === "alive" && (now < invincibleUntil || hasShield(selfId)),
    isHidden: localShipStatus !== "alive"
  }
}
