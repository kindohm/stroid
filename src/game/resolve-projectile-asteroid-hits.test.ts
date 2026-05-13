import { describe, expect, it } from "vitest"
import { gameConfig } from "../shared/game-config"
import type { Asteroid, Projectile } from "../shared/game-types"
import { resolveProjectileAsteroidHits } from "./resolve-projectile-asteroid-hits"

const asteroid: Asteroid = {
  id: "a1",
  size: "medium",
  radius: gameConfig.asteroidRadius.medium,
  position: {
    x: 100,
    y: 100
  },
  velocity: {
    x: 0,
    y: 0
  },
  shape: [1, 1, 1]
}

const projectile: Projectile = {
  id: "p1",
  owner: "mike",
  color: "#74ffe0",
  ttlSeconds: 1,
  position: {
    x: 100,
    y: 100
  },
  velocity: {
    x: 0,
    y: 0
  }
}

describe("resolveProjectileAsteroidHits", () => {
  it("removes hitting projectile and splits hit asteroid", () => {
    const result = resolveProjectileAsteroidHits({
      asteroids: [asteroid],
      projectiles: [projectile],
      createAsteroidId: () => "child",
      random: () => 0.5
    })

    expect(result.projectiles).toEqual([])
    expect(result.destroyedCount).toBe(1)
    expect(result.asteroids).toHaveLength(2)
    expect(result.asteroids.every((child) => child.size === "small")).toBe(true)
  })
})
