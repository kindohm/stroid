import type { BossAsteroid, GameWorld } from "../shared/game-types"

const wrapAxis = (value: number, max: number) => {
  if (value < 0) {
    return max
  }

  if (value > max) {
    return 0
  }

  return value
}

export const updateBossAsteroid = (
  boss: BossAsteroid,
  deltaSeconds: number,
  world: GameWorld
): BossAsteroid => ({
  ...boss,
  position: {
    x: wrapAxis(boss.position.x + boss.velocity.x * deltaSeconds, world.width),
    y: wrapAxis(boss.position.y + boss.velocity.y * deltaSeconds, world.height)
  }
})
