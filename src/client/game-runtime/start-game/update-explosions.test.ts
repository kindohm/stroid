import { describe, expect, it } from "vitest"
import type { RenderExplosion } from "../../render/render-game"
import { updateExplosions } from "./update-explosions"

describe("updateExplosions", () => {
  it("ages current explosions, removes expired ones, and appends incoming explosions", () => {
    const current: RenderExplosion[] = [
      { position: { x: 1, y: 1 }, color: "#f00", ageSeconds: 0.1 },
      { position: { x: 2, y: 2 }, color: "#0f0", ageSeconds: 0.84 }
    ]
    const incoming: RenderExplosion[] = [
      { position: { x: 3, y: 3 }, color: "#00f", ageSeconds: 0 }
    ]

    const nextExplosions = updateExplosions(current, incoming, 0.02)

    expect(nextExplosions).toHaveLength(2)
    expect(nextExplosions[0]).toMatchObject({ position: { x: 1, y: 1 }, color: "#f00" })
    expect(nextExplosions[0]?.ageSeconds).toBeCloseTo(0.12)
    expect(nextExplosions[1]).toEqual({ position: { x: 3, y: 3 }, color: "#00f", ageSeconds: 0 })
  })
})
