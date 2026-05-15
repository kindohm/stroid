import { gameConfig } from "../shared/game-config"
import type { GameWorld, GravityWell, Vector } from "../shared/game-types"
import type { RandomSource } from "./random-source"

const createBorderPosition = (edge: number, world: GameWorld, random: RandomSource): Vector => {
  if (edge === 0) {
    return {
      x: random() * world.width,
      y: 0
    }
  }

  if (edge === 1) {
    return {
      x: world.width,
      y: random() * world.height
    }
  }

  if (edge === 2) {
    return {
      x: random() * world.width,
      y: world.height
    }
  }

  return {
    x: 0,
    y: random() * world.height
  }
}

export const createGravityWell = (id: string, world: GameWorld, random: RandomSource): GravityWell => {
  const edge = Math.floor(random() * 4)
  const position = createBorderPosition(edge, world, random)
  const target = {
    x: world.width * 0.2 + random() * world.width * 0.6,
    y: world.height * 0.2 + random() * world.height * 0.6
  }
  const dx = target.x - position.x
  const dy = target.y - position.y
  const distance = Math.max(1, Math.hypot(dx, dy))
  const speed =
    gameConfig.gravityWellMinSpeed +
    random() * (gameConfig.gravityWellMaxSpeed - gameConfig.gravityWellMinSpeed)

  return {
    id,
    position,
    velocity: {
      x: (dx / distance) * speed,
      y: (dy / distance) * speed
    },
    radius: gameConfig.gravityWellRadius,
    influenceRadius: gameConfig.gravityWellInfluenceRadius,
    strength: gameConfig.gravityWellStrength
  }
}
