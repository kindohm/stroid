import { describe, expect, it, vi } from "vitest"
import { createPowerUpEffectStore } from "./create-power-up-effect-store"

describe("createPowerUpEffectStore", () => {
  it("returns only active effects", () => {
    vi.setSystemTime(1000)
    const store = createPowerUpEffectStore()

    store.setEffect("mike", "shield", 1500)
    store.setEffect("zoe", "scatterShot", 900)

    expect(store.getEffects()).toEqual([{
      playerId: "mike",
      type: "shield",
      expiresAt: 1500
    }])
    vi.useRealTimers()
  })

  it("expires old effects and reports when state changed", () => {
    vi.setSystemTime(1000)
    const store = createPowerUpEffectStore()

    store.setEffect("mike", "asteroidFreeze", 900)

    expect(store.hasActiveAsteroidFreeze()).toBe(false)
    expect(store.expire()).toBe(true)
    expect(store.getEffects()).toEqual([])
    vi.useRealTimers()
  })
})
