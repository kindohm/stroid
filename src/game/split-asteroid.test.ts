import { describe, expect, it } from "vitest"
import { gameConfig } from "../shared/game-config"
import type { Asteroid } from "../shared/game-types"
import { splitAsteroid } from "./split-asteroid"

const createAsteroid = (size: Asteroid["size"]): Asteroid => ({
  id: "a1",
  size,
  radius: gameConfig.asteroidRadius[size],
  position: {
    x: 100,
    y: 100
  },
  velocity: {
    x: 1,
    y: 1
  },
  shape: [1, 1, 1]
})

describe("splitAsteroid", () => {
  it("splits large asteroids into two medium asteroids", () => {
    const children = splitAsteroid(createAsteroid("large"), () => "child", () => 0.5)

    expect(children).toHaveLength(2)
    expect(children.every((child) => child.size === "medium")).toBe(true)
  })

  it("removes small asteroids", () => {
    expect(splitAsteroid(createAsteroid("small"), () => "child", () => 0.5)).toEqual([])
  })
})
