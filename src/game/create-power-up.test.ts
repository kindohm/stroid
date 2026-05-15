import { describe, expect, it } from "vitest"
import { gameConfig } from "../shared/game-config"
import { createPowerUp } from "./create-power-up"

const world = {
  width: 2400,
  height: 2400
}

describe("createPowerUp", () => {
  it("spawns from the left edge and travels right", () => {
    const values = [0.9, 0.5, 0.5, 0, 0.5]
    const powerUp = createPowerUp("power-1", world, () => values.shift() ?? 0)

    expect(powerUp).toEqual(expect.objectContaining({
      id: "power-1",
      type: "shield",
      radius: gameConfig.powerUpRadius
    }))
    expect(powerUp.position.x).toBe(0)
    expect(powerUp.velocity.x).toBeGreaterThan(0)
  })

  it("spawns from the right edge and travels left", () => {
    const values = [0.1, 0.5, 0.5, 0.99, 0.5]
    const powerUp = createPowerUp("power-1", world, () => values.shift() ?? 0)

    expect(powerUp.type).toBe("rapidFire")
    expect(powerUp.position.x).toBe(world.width)
    expect(powerUp.velocity.x).toBeLessThan(0)
  })
})
