import { gameConfig } from "../shared/game-config"
import type { Asteroid, Projectile } from "../shared/game-types"
import type { RandomSource } from "./random-source"
import { splitAsteroid } from "./split-asteroid"

type ResolveProjectileAsteroidHitsArgs = {
  asteroids: Asteroid[]
  projectiles: Projectile[]
  createAsteroidId: () => string
  random: RandomSource
  speedMultiplier?: number
}

type ResolveProjectileAsteroidHitsResult = {
  asteroids: Asteroid[]
  projectiles: Projectile[]
  destroyedCount: number
}

const intersects = (projectile: Projectile, asteroid: Asteroid) =>
  Math.hypot(projectile.position.x - asteroid.position.x, projectile.position.y - asteroid.position.y) <=
  asteroid.radius + gameConfig.projectileRadius

export const resolveProjectileAsteroidHits = ({
  asteroids,
  projectiles,
  createAsteroidId,
  random,
  speedMultiplier = 1
}: ResolveProjectileAsteroidHitsArgs): ResolveProjectileAsteroidHitsResult => {
  const remainingAsteroids = [...asteroids]
  const remainingProjectiles: Projectile[] = []
  const childAsteroids: Asteroid[] = []
  let destroyedCount = 0

  projectiles.forEach((projectile) => {
    const hitIndex = remainingAsteroids.findIndex((asteroid) => intersects(projectile, asteroid))

    if (hitIndex === -1) {
      remainingProjectiles.push(projectile)
      return
    }

    const [hitAsteroid] = remainingAsteroids.splice(hitIndex, 1)
    destroyedCount += 1
    childAsteroids.push(...splitAsteroid(hitAsteroid, createAsteroidId, random, speedMultiplier))
  })

  return {
    asteroids: [...remainingAsteroids, ...childAsteroids],
    projectiles: remainingProjectiles,
    destroyedCount
  }
}
