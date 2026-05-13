import { describe, expect, it } from "vitest"
import type { Asteroid } from "../shared/game-types"
import { updateAsteroids } from "./update-asteroids"

const world = {
  width: 100,
  height: 100
}

const asteroid: Asteroid = {
  id: "a1",
  size: "large",
  radius: 54,
  position: {
    x: 99,
    y: 50
  },
  velocity: {
    x: 5,
    y: 0
  },
  shape: [1, 1, 1]
}

describe("updateAsteroids", () => {
  it("wraps asteroids across world borders", () => {
    const [updated] = updateAsteroids([asteroid], 1, world)

    expect(updated.position.x).toBe(0)
    expect(updated.velocity).toEqual(asteroid.velocity)
  })
})
