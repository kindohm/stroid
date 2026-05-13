import { describe, expect, it } from "vitest"
import { createRandomVelocity } from "./create-random-velocity"

describe("createRandomVelocity", () => {
  it("applies speed multiplier", () => {
    const normal = createRandomVelocity(() => 0, 1)
    const faster = createRandomVelocity(() => 0, 2)

    expect(faster.x).toBe(normal.x * 2)
    expect(faster.y).toBe(normal.y * 2)
  })
})
