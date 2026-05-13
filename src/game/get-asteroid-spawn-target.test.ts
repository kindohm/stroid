import { describe, expect, it } from "vitest"
import { gameConfig } from "../shared/game-config"
import { getAsteroidSpawnTarget } from "./get-asteroid-spawn-target"

describe("getAsteroidSpawnTarget", () => {
  it("starts with a small asteroid target", () => {
    expect(getAsteroidSpawnTarget(0, 0)).toBe(gameConfig.initialAsteroidTarget)
  })

  it("increases from spawned and destroyed counts", () => {
    expect(getAsteroidSpawnTarget(12, 0)).toBe(gameConfig.initialAsteroidTarget + 1)
  })

  it("does not increase before the slower pressure step", () => {
    expect(getAsteroidSpawnTarget(5, 5)).toBe(gameConfig.initialAsteroidTarget)
  })
})
