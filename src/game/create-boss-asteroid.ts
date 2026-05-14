import { gameConfig } from "../shared/game-config"
import type { BossAsteroid, GameWorld } from "../shared/game-types"
import { createAsteroidShape } from "./create-asteroid-shape"
import type { RandomSource } from "./random-source"

export const createBossAsteroid = (
  id: string,
  name: string,
  world: GameWorld,
  maxHealth: number,
  random: RandomSource = Math.random
): BossAsteroid => {
  const side = Math.floor(random() * 4)
  const alongEdge = random()
  const angleToCenter = side === 0
    ? Math.PI / 2
    : side === 1
      ? Math.PI
      : side === 2
        ? -Math.PI / 2
        : 0
  const position = side === 0
    ? { x: alongEdge * world.width, y: 0 }
    : side === 1
      ? { x: world.width, y: alongEdge * world.height }
      : side === 2
        ? { x: alongEdge * world.width, y: world.height }
        : { x: 0, y: alongEdge * world.height }

  return {
    id,
    name,
    position,
    velocity: {
      x: Math.cos(angleToCenter) * gameConfig.bossSpeed,
      y: Math.sin(angleToCenter) * gameConfig.bossSpeed
    },
    radius: gameConfig.bossRadius,
    shape: createAsteroidShape(random, 18),
    health: maxHealth,
    maxHealth
  }
}
