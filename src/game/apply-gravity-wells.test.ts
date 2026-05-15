import { describe, expect, it } from "vitest"
import { gameConfig } from "../shared/game-config"
import { applyGravityWells } from "./apply-gravity-wells"

const gravityWell = {
  id: "gravity-well-1",
  radius: gameConfig.gravityWellRadius,
  influenceRadius: gameConfig.gravityWellInfluenceRadius,
  strength: gameConfig.gravityWellStrength,
  position: { x: 100, y: 0 },
  velocity: { x: 0, y: 0 }
}

describe("applyGravityWells", () => {
  it("accelerates objects toward nearby gravity wells", () => {
    const velocity = applyGravityWells({ x: 0, y: 0 }, { x: 0, y: 0 }, [gravityWell], 1)

    expect(velocity.x).toBeGreaterThan(0)
    expect(velocity.y).toBe(0)
  })

  it("still creates noticeable acceleration near the influence edge", () => {
    const velocity = applyGravityWells(
      { x: 0, y: 0 },
      { x: gravityWell.position.x - gravityWell.influenceRadius + 20, y: 0 },
      [gravityWell],
      1
    )

    expect(velocity.x).toBeGreaterThan(60)
  })

  it("ignores objects outside the influence radius", () => {
    expect(applyGravityWells(
      { x: 12, y: 4 },
      { x: -1000, y: 0 },
      [gravityWell],
      1
    )).toEqual({ x: 12, y: 4 })
  })
})
