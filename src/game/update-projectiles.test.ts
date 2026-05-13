import { describe, expect, it } from "vitest"
import type { Projectile } from "../shared/game-types"
import { updateProjectiles } from "./update-projectiles"

const world = {
  width: 500,
  height: 500
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
    x: 50,
    y: 0
  }
}

describe("updateProjectiles", () => {
  it("moves projectiles by velocity", () => {
    const [updated] = updateProjectiles([projectile], 0.5, world)

    expect(updated.position.x).toBe(125)
    expect(updated.position.y).toBe(100)
  })

  it("removes expired projectiles", () => {
    const updated = updateProjectiles([projectile], 1.2, world)

    expect(updated).toEqual([])
  })

  it("removes projectiles outside the world", () => {
    const updated = updateProjectiles(
      [
        {
          ...projectile,
          position: {
            x: 499,
            y: 100
          }
        }
      ],
      1,
      world
    )

    expect(updated).toEqual([])
  })
})
