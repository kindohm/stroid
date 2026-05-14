import { gameConfig } from "../shared/game-config"
import type { Asteroid, BossAsteroid } from "../shared/game-types"
import { createAsteroidShape } from "./create-asteroid-shape"
import { createRandomVelocity } from "./create-random-velocity"
import type { RandomSource } from "./random-source"

export const createBossDefeatAsteroids = (
  boss: BossAsteroid,
  createId: () => string,
  random: RandomSource = Math.random
): Asteroid[] =>
  Array.from({ length: 3 }, () => ({
    id: createId(),
    size: "large",
    radius: gameConfig.asteroidRadius.large,
    position: boss.position,
    velocity: createRandomVelocity(random, 0.7),
    shape: createAsteroidShape(random)
  }))
