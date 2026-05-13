import { gameConfig } from "../shared/game-config"

export const getAsteroidSpawnTarget = (asteroidsSpawned: number, asteroidsDestroyed: number) =>
  Math.min(
    gameConfig.maxAsteroidTarget,
    gameConfig.initialAsteroidTarget +
      Math.floor((asteroidsSpawned + asteroidsDestroyed) / gameConfig.asteroidSpawnPressureStep)
  )
