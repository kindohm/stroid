import { gameConfig } from "../shared/game-config"
import type { PlayerShip } from "../shared/game-types"

export const createStartingPlayerShip = (index: number, totalPlayers: number): PlayerShip => {
  const width = gameConfig.mapTilesWide * gameConfig.tileSize
  const height = gameConfig.mapTilesTall * gameConfig.tileSize
  const spread = Math.max(80, Math.min(180, totalPlayers * 26))
  const angle = (index / Math.max(1, totalPlayers)) * Math.PI * 2

  return {
    position: {
      x: width / 2 + Math.cos(angle) * spread,
      y: height / 2 + Math.sin(angle) * spread
    },
    velocity: {
      x: 0,
      y: 0
    },
    angle: -Math.PI / 2
  }
}
