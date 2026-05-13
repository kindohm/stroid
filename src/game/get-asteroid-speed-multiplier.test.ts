import { describe, expect, it } from "vitest"
import { gameConfig } from "../shared/game-config"
import { getAsteroidSpeedMultiplier } from "./get-asteroid-speed-multiplier"

describe("getAsteroidSpeedMultiplier", () => {
  it("starts at normal speed", () => {
    expect(getAsteroidSpeedMultiplier(0, 0)).toBe(1)
  })

  it("increases from spawned and destroyed counts", () => {
    expect(getAsteroidSpeedMultiplier(12, 0)).toBe(1 + gameConfig.asteroidSpeedMultiplierStep)
  })

  it("does not increase before the slower pressure step", () => {
    expect(getAsteroidSpeedMultiplier(5, 5)).toBe(1)
  })
})
