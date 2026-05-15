import { createStartingPlayerShip } from "../../../game/create-starting-player-ship"
import type { GameWorld, PlayerShip } from "../../../shared/game-types"
import type { LobbyPlayer } from "../../../shared/lobby-types"

export const createShipStore = (world: GameWorld) => {
  const shipsByPlayerId = new Map<string, PlayerShip>()

  const syncShips = (players: LobbyPlayer[]) => {
    players.forEach((player, index) => {
      if (!shipsByPlayerId.has(player.id)) {
        shipsByPlayerId.set(player.id, createStartingPlayerShip(index, players.length, world))
      }
    })
  }

  return {
    get: (playerId: string) => shipsByPlayerId.get(playerId),
    set: (playerId: string, ship: PlayerShip) => shipsByPlayerId.set(playerId, ship),
    syncShips
  }
}
