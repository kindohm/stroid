import type { Asteroid, GameWorld, GravityWell } from "../shared/game-types"
import { applyGravityWells } from "./apply-gravity-wells"

const wrapAxis = (value: number, max: number) => {
  if (value < 0) {
    return max
  }

  if (value > max) {
    return 0
  }

  return value
}

export const updateAsteroids = (
  asteroids: Asteroid[],
  deltaSeconds: number,
  world: GameWorld,
  gravityWells: GravityWell[] = []
): Asteroid[] =>
  asteroids.map((asteroid) => {
    const velocity = applyGravityWells(asteroid.velocity, asteroid.position, gravityWells, deltaSeconds)

    return {
      ...asteroid,
      velocity,
      position: {
        x: wrapAxis(asteroid.position.x + velocity.x * deltaSeconds, world.width),
        y: wrapAxis(asteroid.position.y + velocity.y * deltaSeconds, world.height)
      }
    }
  })
