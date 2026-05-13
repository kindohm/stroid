import type { GameWorld, Projectile } from "../shared/game-types"

const isInsideWorld = (projectile: Projectile, world: GameWorld) =>
  projectile.position.x >= 0 &&
  projectile.position.x <= world.width &&
  projectile.position.y >= 0 &&
  projectile.position.y <= world.height

export const updateProjectiles = (
  projectiles: Projectile[],
  deltaSeconds: number,
  world: GameWorld
): Projectile[] =>
  projectiles
    .map((projectile) => ({
      ...projectile,
      ttlSeconds: projectile.ttlSeconds - deltaSeconds,
      position: {
        x: projectile.position.x + projectile.velocity.x * deltaSeconds,
        y: projectile.position.y + projectile.velocity.y * deltaSeconds
      }
    }))
    .filter((projectile) => projectile.ttlSeconds > 0 && isInsideWorld(projectile, world))
