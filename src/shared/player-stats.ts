import type { AsteroidSize, PowerUpType } from "./game-types"
import type { PlayerDeathCause } from "./lobby-types"

export type PlayerStats = {
  shotsFired: number
  asteroidsHit: number
  thrustSeconds: number
  rotationSeconds: number
  gamesPlayed: number
  deathsByCause: Record<PlayerDeathCause, number>
  powerUpsCollected: Record<PowerUpType, number>
  bossHits: number
  bossDefeats: number
  asteroidHitsBySize: Record<AsteroidSize, number>
  asteroidHitsByName: Record<string, number>
  bestGameScore: number
  firstPlayedAt?: number
  lastPlayedAt?: number
}

export const createDefaultPlayerStats = (): PlayerStats => ({
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

const sanitizeCount = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0

const sanitizeTimestamp = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined

const sanitizeRecord = <Key extends string>(
  value: unknown,
  keys: readonly Key[]
): Record<Key, number> => {
  const source: Partial<Record<Key, unknown>> = value && typeof value === "object"
    ? value as Partial<Record<Key, unknown>>
    : {}

  return keys.reduce((record, key) => ({
    ...record,
    [key]: sanitizeCount(source[key])
  }), {} as Record<Key, number>)
}

const sanitizeNameRecord = (value: unknown) => {
  if (!value || typeof value !== "object") {
    return {}
  }

  return Object.entries(value as Record<string, unknown>)
    .slice(0, 40)
    .reduce<Record<string, number>>((record, [name, count]) => {
      const sanitizedName = name.trim().slice(0, 48)
      const sanitizedCount = sanitizeCount(count)

      if (!sanitizedName || sanitizedCount === 0) {
        return record
      }

      return {
        ...record,
        [sanitizedName]: sanitizedCount
      }
    }, {})
}

export const sanitizePlayerStats = (value: unknown): PlayerStats | undefined => {
  if (!value || typeof value !== "object") {
    return undefined
  }

  const source = value as Partial<Record<keyof PlayerStats, unknown>>
  const firstPlayedAt = sanitizeTimestamp(source.firstPlayedAt)
  const lastPlayedAt = sanitizeTimestamp(source.lastPlayedAt)

  return {
    shotsFired: sanitizeCount(source.shotsFired),
    asteroidsHit: sanitizeCount(source.asteroidsHit),
    thrustSeconds: sanitizeCount(source.thrustSeconds),
    rotationSeconds: sanitizeCount(source.rotationSeconds),
    gamesPlayed: sanitizeCount(source.gamesPlayed),
    deathsByCause: sanitizeRecord(source.deathsByCause, ["asteroid", "friendlyProjectile", "shipCollision", "unknown"]),
    powerUpsCollected: sanitizeRecord(source.powerUpsCollected, ["shield", "scatterShot", "asteroidFreeze"]),
    bossHits: sanitizeCount(source.bossHits),
    bossDefeats: sanitizeCount(source.bossDefeats),
    asteroidHitsBySize: sanitizeRecord(source.asteroidHitsBySize, ["extraLarge", "large", "medium", "small"]),
    asteroidHitsByName: sanitizeNameRecord(source.asteroidHitsByName),
    bestGameScore: sanitizeCount(source.bestGameScore),
    ...(firstPlayedAt ? { firstPlayedAt } : {}),
    ...(lastPlayedAt ? { lastPlayedAt } : {})
  }
}
