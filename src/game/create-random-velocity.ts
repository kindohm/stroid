import { gameConfig } from "../shared/game-config"
import type { Vector } from "../shared/game-types"
import type { RandomSource } from "./random-source"

export const createRandomVelocity = (random: RandomSource, speedMultiplier = 1): Vector => {
  const angle = random() * Math.PI * 2
  const speed =
    gameConfig.asteroidMinSpeed +
    random() * (gameConfig.asteroidMaxSpeed - gameConfig.asteroidMinSpeed)
  const scaledSpeed = speed * speedMultiplier

  return {
    x: Math.cos(angle) * scaledSpeed,
    y: Math.sin(angle) * scaledSpeed
  }
}
