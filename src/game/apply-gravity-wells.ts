import { gameConfig } from "../shared/game-config"
import type { GravityWell, Vector } from "../shared/game-types"

export const applyGravityWells = (
  velocity: Vector,
  position: Vector,
  gravityWells: GravityWell[],
  deltaSeconds: number
): Vector =>
  gravityWells.reduce((nextVelocity, gravityWell) => {
    const dx = gravityWell.position.x - position.x
    const dy = gravityWell.position.y - position.y
    const distance = Math.hypot(dx, dy)

    if (distance <= 0 || distance > gravityWell.influenceRadius) {
      return nextVelocity
    }

    const falloffDistance = Math.max(gravityWell.radius, distance)
    const edgeAcceleration = gravityWell.strength / gravityWell.influenceRadius ** 2
    const inverseSquareAcceleration = gravityWell.strength / falloffDistance ** 2
    const falloffRatio = 1 - distance / gravityWell.influenceRadius
    const broadPullAcceleration = edgeAcceleration * (1 + falloffRatio * 1.5)
    const acceleration = Math.min(
      gameConfig.gravityWellMaxAcceleration,
      inverseSquareAcceleration + broadPullAcceleration
    )

    return {
      x: nextVelocity.x + (dx / distance) * acceleration * deltaSeconds,
      y: nextVelocity.y + (dy / distance) * acceleration * deltaSeconds
    }
  }, velocity)
