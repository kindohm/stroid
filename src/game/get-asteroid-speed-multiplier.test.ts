import { describe, expect, it } from "vitest"
import { getAsteroidSpeedMultiplier } from "./get-asteroid-speed-multiplier"

describe("getAsteroidSpeedMultiplier", () => {
  it("starts at normal speed", () => {
    expect(getAsteroidSpeedMultiplier(0, 0)).toBe(1)
  })

  it("increases from spawned and destroyed counts", () => {
    expect(getAsteroidSpeedMultiplier(20, 10)).toBeGreaterThan(getAsteroidSpeedMultiplier(0, 0))
  })
})
