import { gameConfig } from "../shared/game-config"
import type { PlayerShip, Projectile } from "../shared/game-types"

export const createProjectile = (
  id: string,
  owner: string,
  color: string,
  ship: PlayerShip
): Projectile => {
  const noseOffset = gameConfig.shipRadius + gameConfig.projectileRadius + 6

  return {
    id,
    owner,
    color,
    ttlSeconds: gameConfig.projectileTtlSeconds,
    position: {
      x: ship.position.x + Math.cos(ship.angle) * noseOffset,
      y: ship.position.y + Math.sin(ship.angle) * noseOffset
    },
    velocity: {
      x: ship.velocity.x + Math.cos(ship.angle) * gameConfig.projectileSpeed,
      y: ship.velocity.y + Math.sin(ship.angle) * gameConfig.projectileSpeed
    }
  }
}
