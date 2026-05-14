import { beforeEach, describe, expect, it, vi } from "vitest"
import { loadPlayerStats, savePlayerStats, updatePlayerStats } from "./player-stats"

const createStorage = () => {
  const values = new Map<string, string>()

  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value)
    })
  }
}

describe("playerStats", () => {
  beforeEach(() => {
    vi.useRealTimers()
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: createStorage()
    })
  })

  it("loads defaults when storage is empty", () => {
    expect(loadPlayerStats()).toEqual({
      shotsFired: 0,
      asteroidsHit: 0,
      thrustSeconds: 0,
      rotationSeconds: 0,
      gamesPlayed: 0,
      deathsByCause: {
        asteroid: 0,
        friendlyProjectile: 0,
        shipCollision: 0,
        unknown: 0
      },
      powerUpsCollected: {
        shield: 0,
        scatterShot: 0,
        asteroidFreeze: 0
      },
      bossHits: 0,
      bossDefeats: 0,
      asteroidHitsBySize: {
        extraLarge: 0,
        large: 0,
        medium: 0,
        small: 0
      },
      asteroidHitsByName: {},
      bestGameScore: 0
    })
  })

  it("sanitizes stored values", () => {
    localStorage.setItem("stroid.playerStats", JSON.stringify({
      shotsFired: 3,
      asteroidsHit: -1,
      thrustSeconds: 2.5,
      rotationSeconds: Number.NaN,
      gamesPlayed: 1,
      deathsByCause: {
        asteroid: 2,
        friendlyProjectile: -1
      },
      powerUpsCollected: {
        shield: 4
      },
      bossHits: 9,
      bossDefeats: "nope",
      asteroidHitsBySize: {
        large: 3
      },
      asteroidHitsByName: {
        "Mega Mabel": 2,
        "": 5
      },
      bestGameScore: 1200,
      firstPlayedAt: 100,
      lastPlayedAt: 200
    }))

    expect(loadPlayerStats()).toEqual({
      shotsFired: 3,
      asteroidsHit: 0,
      thrustSeconds: 2.5,
      rotationSeconds: 0,
      gamesPlayed: 1,
      deathsByCause: {
        asteroid: 2,
        friendlyProjectile: 0,
        shipCollision: 0,
        unknown: 0
      },
      powerUpsCollected: {
        shield: 4,
        scatterShot: 0,
        asteroidFreeze: 0
      },
      bossHits: 9,
      bossDefeats: 0,
      asteroidHitsBySize: {
        extraLarge: 0,
        large: 3,
        medium: 0,
        small: 0
      },
      asteroidHitsByName: {
        "Mega Mabel": 2
      },
      bestGameScore: 1200,
      firstPlayedAt: 100,
      lastPlayedAt: 200
    })
  })

  it("saves and increments stats", () => {
    vi.setSystemTime(1000)
    savePlayerStats({
      shotsFired: 1,
      asteroidsHit: 2,
      thrustSeconds: 3,
      rotationSeconds: 4,
      gamesPlayed: 5,
      deathsByCause: {
        asteroid: 1,
        friendlyProjectile: 0,
        shipCollision: 0,
        unknown: 0
      },
      powerUpsCollected: {
        shield: 0,
        scatterShot: 1,
        asteroidFreeze: 0
      },
      bossHits: 2,
      bossDefeats: 0,
      asteroidHitsBySize: {
        extraLarge: 0,
        large: 1,
        medium: 0,
        small: 1
      },
      asteroidHitsByName: {
        Larry: 1
      },
      bestGameScore: 900,
      firstPlayedAt: 500,
      lastPlayedAt: 800
    })
    updatePlayerStats({
      shotsFired: 2,
      thrustSeconds: 0.5,
      gamesPlayed: 1,
      deathsByCause: {
        asteroid: 1
      },
      powerUpsCollected: {
        shield: 2
      },
      bossHits: 3,
      bossDefeats: 1,
      asteroidHitsBySize: {
        large: 2
      },
      asteroidHitsByName: {
        Larry: 2,
        Sally: 1
      },
      bestGameScore: 1200
    })

    expect(loadPlayerStats()).toEqual({
      shotsFired: 3,
      asteroidsHit: 2,
      thrustSeconds: 3.5,
      rotationSeconds: 4,
      gamesPlayed: 6,
      deathsByCause: {
        asteroid: 2,
        friendlyProjectile: 0,
        shipCollision: 0,
        unknown: 0
      },
      powerUpsCollected: {
        shield: 2,
        scatterShot: 1,
        asteroidFreeze: 0
      },
      bossHits: 5,
      bossDefeats: 1,
      asteroidHitsBySize: {
        extraLarge: 0,
        large: 3,
        medium: 0,
        small: 1
      },
      asteroidHitsByName: {
        Larry: 3,
        Sally: 1
      },
      bestGameScore: 1200,
      firstPlayedAt: 500,
      lastPlayedAt: 1000
    })
  })
})
