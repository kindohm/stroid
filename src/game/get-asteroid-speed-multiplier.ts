import { gameConfig } from "../shared/game-config"

export const getAsteroidSpeedMultiplier = (asteroidsSpawned: number, asteroidsDestroyed: number) =>
  Math.min(
    gameConfig.asteroidMaxSpeedMultiplier,
    1 + Math.floor((asteroidsSpawned + asteroidsDestroyed) / gameConfig.asteroidPressureStep) * 0.12
  )
