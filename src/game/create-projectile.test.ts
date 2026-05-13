import { describe, expect, it } from "vitest"
import { gameConfig } from "../shared/game-config"
import type { PlayerShip } from "../shared/game-types"
import { createProjectile } from "./create-projectile"

const ship: PlayerShip = {
  position: {
    x: 100,
    y: 100
  },
  velocity: {
    x: 5,
    y: 10
  },
  angle: 0
}

describe("createProjectile", () => {
  it("spawns from the nose of the ship", () => {
    const projectile = createProjectile("p1", "mike", "#74ffe0", ship)

    expect(projectile.position.x).toBeGreaterThan(ship.position.x + gameConfig.shipRadius)
    expect(projectile.position.y).toBe(ship.position.y)
  })

  it("inherits ship velocity and adds forward shot speed", () => {
    const projectile = createProjectile("p1", "mike", "#74ffe0", ship)

    expect(projectile.velocity.x).toBe(gameConfig.projectileSpeed + ship.velocity.x)
    expect(projectile.velocity.y).toBe(ship.velocity.y)
  })
})
