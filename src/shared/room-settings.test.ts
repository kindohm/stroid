import { describe, expect, it } from "vitest"
import {
  createGameWorld,
  createRandomRoomSettings,
  defaultRoomSettings,
  getAsteroidDensityTarget,
  sanitizeRoomSettings
} from "./room-settings"

describe("roomSettings", () => {
  it("sanitizes settings into supported ranges", () => {
    expect(sanitizeRoomSettings({
      mapSize: "nope",
      asteroidDensity: 7,
      playerLives: 22,
      friendlyFire: true,
      maxShipSpeed: 120,
      bossIntervalMinutes: 50,
      bossHealthPerPlayer: 3
    })).toEqual({
      ...defaultRoomSettings,
      asteroidDensity: 1,
      playerLives: 9,
      friendlyFire: true,
      maxShipSpeed: 800,
      bossIntervalMinutes: 20,
      bossHealthPerPlayer: 5
    })
  })

  it("creates smaller worlds for tiny maps", () => {
    const tiny = createGameWorld({
      ...defaultRoomSettings,
      mapSize: "tiny"
    })
    const standard = createGameWorld(defaultRoomSettings)

    expect(tiny.width).toBeLessThan(standard.width)
    expect(tiny.height).toBe(tiny.width)
  })

  it("maps low asteroid density to a minimal target", () => {
    expect(getAsteroidDensityTarget({
      ...defaultRoomSettings,
      asteroidDensity: 0
    }, 0, 0)).toBe(1)
  })

  it("randomizes settings in supported ranges", () => {
    const settings = createRandomRoomSettings(() => 0.99)

    expect(settings.mapSize).toBe("huge")
    expect(settings.asteroidDensity).toBe(1)
    expect(settings.playerLives).toBe(9)
    expect(settings.friendlyFire).toBe(true)
    expect(settings.maxShipSpeed).toBe(2400)
    expect(settings.bossIntervalMinutes).toBe(20)
    expect(settings.bossHealthPerPlayer).toBe(100)
  })
})
