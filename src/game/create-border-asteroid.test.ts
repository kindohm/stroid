import { describe, expect, it } from "vitest"
import { createBorderAsteroid } from "./create-border-asteroid"

const world = {
  width: 1000,
  height: 800
}

describe("createBorderAsteroid", () => {
  it("spawns on a world border", () => {
    const randomValues = [0.1, 0.1, 0.3, 0.4, 0.8, 0.6, ...Array(11).fill(0.5)]
    const asteroid = createBorderAsteroid("a1", world, () => randomValues.shift() ?? 0.5)

    expect(asteroid.position.y).toBe(0)
    expect(asteroid.size).toBe("large")
  })

  it("rarely creates extra large asteroids when random roll is low", () => {
    const randomValues = [0.01, 0.1, 0.3, 0.4, 0.8, 0.6, ...Array(11).fill(0.5)]
    const asteroid = createBorderAsteroid("a1", world, () => randomValues.shift() ?? 0.5)

    expect(asteroid.size).toBe("extraLarge")
  })
})
