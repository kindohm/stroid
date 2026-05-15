import { describe, expect, it } from "vitest"
import { gameConfig } from "../shared/game-config"
import { updateGravityWells } from "./update-gravity-wells"

describe("updateGravityWells", () => {
  it("moves gravity wells by velocity", () => {
    const [gravityWell] = updateGravityWells([{
      id: "gravity-well-1",
      radius: gameConfig.gravityWellRadius,
      influenceRadius: gameConfig.gravityWellInfluenceRadius,
      strength: gameConfig.gravityWellStrength,
      position: { x: 10, y: 20 },
      velocity: { x: 5, y: -2 }
    }], 2, {
      width: 1000,
      height: 800
    })

    expect(gravityWell?.position).toEqual({
      x: 20,
      y: 16
    })
  })
})
