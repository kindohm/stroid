import { describe, expect, it } from "vitest"
import type { PowerUp } from "../shared/game-types"
import { updatePowerUps } from "./update-power-ups"

const world = {
  width: 100,
  height: 100
}

const powerUp: PowerUp = {
  id: "power-1",
  type: "shield",
  radius: 10,
  position: {
    x: 0,
    y: 50
  },
  velocity: {
    x: 20,
    y: 0
  }
}

describe("updatePowerUps", () => {
  it("moves powerups by velocity", () => {
    expect(updatePowerUps([powerUp], 0.5, world)[0]?.position.x).toBe(10)
  })

  it("removes powerups after they cross a boundary", () => {
    const expiredPowerUp = {
      ...powerUp,
      position: {
        x: 120,
        y: 50
      }
    }

    expect(updatePowerUps([expiredPowerUp], 0.1, world)).toEqual([])
  })
})
