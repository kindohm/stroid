import type { GameWorld, GravityWell, Projectile } from "../shared/game-types"
import { applyGravityWells } from "./apply-gravity-wells"

const isInsideWorld = (projectile: Projectile, world: GameWorld) =>
  projectile.position.x >= 0 &&
  projectile.position.x <= world.width &&
  projectile.position.y >= 0 &&
  projectile.position.y <= world.height

export const updateProjectiles = (
  projectiles: Projectile[],
  deltaSeconds: number,
  world: GameWorld,
  gravityWells: GravityWell[] = []
): Projectile[] =>
  projectiles
    .map((projectile) => {
      const velocity = applyGravityWells(projectile.velocity, projectile.position, gravityWells, deltaSeconds)

      return {
        ...projectile,
        velocity,
        ttlSeconds: projectile.ttlSeconds - deltaSeconds,
        position: {
          x: projectile.position.x + velocity.x * deltaSeconds,
          y: projectile.position.y + velocity.y * deltaSeconds
        }
      }
    })
    .filter((projectile) => projectile.ttlSeconds > 0 && isInsideWorld(projectile, world))
