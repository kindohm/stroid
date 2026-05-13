import { gameConfig } from "../shared/game-config"
import type { PlayerShip } from "../shared/game-types"

export const createInitialPlayer = (): PlayerShip => {
  const width = gameConfig.mapTilesWide * gameConfig.tileSize
  const height = gameConfig.mapTilesTall * gameConfig.tileSize

  return {
    position: {
      x: width / 2,
      y: height / 2
    },
    velocity: {
      x: 0,
      y: 0
    },
    angle: -Math.PI / 2
  }
}
