import type { Asteroid, GameWorld } from "../shared/game-types"

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
  world: GameWorld
): Asteroid[] =>
  asteroids.map((asteroid) => ({
    ...asteroid,
    position: {
      x: wrapAxis(asteroid.position.x + asteroid.velocity.x * deltaSeconds, world.width),
      y: wrapAxis(asteroid.position.y + asteroid.velocity.y * deltaSeconds, world.height)
    }
  }))
