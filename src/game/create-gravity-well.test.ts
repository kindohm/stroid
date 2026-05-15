import { describe, expect, it } from "vitest"
import { gameConfig } from "../shared/game-config"
import { createGravityWell } from "./create-gravity-well"

describe("createGravityWell", () => {
  it("spawns on a map border and moves inward", () => {
    const gravityWell = createGravityWell("gravity-well-1", {
      width: 1000,
      height: 800
    }, () => 0)

    expect(gravityWell.position).toEqual({
      x: 0,
      y: 0
    })
    expect(gravityWell.velocity.x).toBeGreaterThan(0)
    expect(gravityWell.velocity.y).toBeGreaterThan(0)
    expect(gravityWell.radius).toBe(gameConfig.gravityWellRadius)
    expect(gravityWell.influenceRadius).toBe(gameConfig.gravityWellInfluenceRadius)
  })
})
