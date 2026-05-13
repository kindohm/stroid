import { gameConfig } from "../shared/game-config"
import type { Asteroid, AsteroidSize, GameWorld } from "../shared/game-types"
import { createAsteroidShape } from "./create-asteroid-shape"
import { createRandomVelocity } from "./create-random-velocity"
import type { RandomSource } from "./random-source"

const createBorderPosition = (random: RandomSource, world: GameWorld) => {
  const edge = Math.floor(random() * 4)
  const x = random() * world.width
  const y = random() * world.height

  if (edge === 0) {
    return { x, y: 0 }
  }

  if (edge === 1) {
    return { x: world.width, y }
  }

  if (edge === 2) {
    return { x, y: world.height }
  }

  return { x: 0, y }
}

const createSpawnSize = (random: RandomSource): AsteroidSize =>
  random() < gameConfig.asteroidExtraLargeChance ? "extraLarge" : "large"

export const createBorderAsteroid = (
  id: string,
  world: GameWorld,
  random: RandomSource,
  speedMultiplier = 1
): Asteroid => {
  const size = createSpawnSize(random)

  return {
    id,
    size,
    radius: gameConfig.asteroidRadius[size],
    position: createBorderPosition(random, world),
    velocity: createRandomVelocity(random, speedMultiplier),
    shape: createAsteroidShape(random)
  }
}
