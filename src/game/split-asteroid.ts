import { gameConfig } from "../shared/game-config"
import type { Asteroid, AsteroidSize } from "../shared/game-types"
import { createAsteroidShape } from "./create-asteroid-shape"
import { createRandomVelocity } from "./create-random-velocity"
import type { RandomSource } from "./random-source"

const childSizeByParent: Record<AsteroidSize, AsteroidSize | undefined> = {
  extraLarge: "large",
  large: "medium",
  medium: "small",
  small: undefined
}

export const splitAsteroid = (
  asteroid: Asteroid,
  createId: () => string,
  random: RandomSource,
  speedMultiplier = 1
): Asteroid[] => {
  const childSize = childSizeByParent[asteroid.size]

  if (!childSize) {
    return []
  }

  return Array.from({ length: 2 }, () => ({
    id: createId(),
    size: childSize,
    radius: gameConfig.asteroidRadius[childSize],
    position: {
      x: asteroid.position.x,
      y: asteroid.position.y
    },
    velocity: createRandomVelocity(random, speedMultiplier),
    shape: createAsteroidShape(random)
  }))
}
