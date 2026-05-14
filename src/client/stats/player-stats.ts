import type { AsteroidSize, PowerUpType } from "../../shared/game-types"
import type { PlayerDeathCause } from "../../shared/lobby-types"

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

const playerStatsStorageKey = "stroid.playerStats"

const createDefaultPlayerStats = (): PlayerStats => ({
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

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, number>>((record, [name, count]) => {
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

const sanitizePlayerStats = (value: unknown): PlayerStats | undefined => {
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

export const loadPlayerStats = (): PlayerStats => {
  try {
    const stored = localStorage.getItem(playerStatsStorageKey)

    if (!stored) {
      return createDefaultPlayerStats()
    }

    return sanitizePlayerStats(JSON.parse(stored)) ?? createDefaultPlayerStats()
  } catch {
    return createDefaultPlayerStats()
  }
}

export const savePlayerStats = (stats: PlayerStats) => {
  try {
    localStorage.setItem(playerStatsStorageKey, JSON.stringify(stats))
  } catch {
    // Local storage is best-effort; gameplay should keep working without stats persistence.
  }
}

export type PlayerStatsUpdate = Partial<Omit<
  PlayerStats,
  "asteroidHitsByName" | "asteroidHitsBySize" | "deathsByCause" | "firstPlayedAt" | "lastPlayedAt" | "powerUpsCollected"
>> & {
  asteroidHitsByName?: Record<string, number>
  asteroidHitsBySize?: Partial<Record<AsteroidSize, number>>
  deathsByCause?: Partial<Record<PlayerDeathCause, number>>
  powerUpsCollected?: Partial<Record<PowerUpType, number>>
}

const addRecord = <Key extends string>(
  currentRecord: Record<Key, number>,
  updateRecord: Partial<Record<Key, number>> | undefined
): Record<Key, number> =>
  Object.keys(currentRecord).reduce((record, key) => ({
    ...record,
    [key]: currentRecord[key as Key] + (updateRecord?.[key as Key] ?? 0)
  }), {} as Record<Key, number>)

const addNameRecord = (currentRecord: Record<string, number>, updateRecord: Record<string, number> | undefined) => {
  if (!updateRecord) {
    return currentRecord
  }

  return Object.entries(updateRecord).reduce((record, [name, count]) => {
    const sanitizedName = name.trim().slice(0, 48)

    if (!sanitizedName || count <= 0) {
      return record
    }

    return {
      ...record,
      [sanitizedName]: (record[sanitizedName] ?? 0) + count
    }
  }, currentRecord)
}

export const updatePlayerStats = (update: PlayerStatsUpdate) => {
  const currentStats = loadPlayerStats()
  const now = Date.now()
  const gamesPlayed = currentStats.gamesPlayed + (update.gamesPlayed ?? 0)

  savePlayerStats({
    shotsFired: currentStats.shotsFired + (update.shotsFired ?? 0),
    asteroidsHit: currentStats.asteroidsHit + (update.asteroidsHit ?? 0),
    thrustSeconds: currentStats.thrustSeconds + (update.thrustSeconds ?? 0),
    rotationSeconds: currentStats.rotationSeconds + (update.rotationSeconds ?? 0),
    gamesPlayed,
    deathsByCause: addRecord(currentStats.deathsByCause, update.deathsByCause),
    powerUpsCollected: addRecord(currentStats.powerUpsCollected, update.powerUpsCollected),
    bossHits: currentStats.bossHits + (update.bossHits ?? 0),
    bossDefeats: currentStats.bossDefeats + (update.bossDefeats ?? 0),
    asteroidHitsBySize: addRecord(currentStats.asteroidHitsBySize, update.asteroidHitsBySize),
    asteroidHitsByName: addNameRecord(currentStats.asteroidHitsByName, update.asteroidHitsByName),
    bestGameScore: Math.max(currentStats.bestGameScore, update.bestGameScore ?? 0),
    firstPlayedAt: currentStats.firstPlayedAt ?? (update.gamesPlayed ? now : undefined),
    lastPlayedAt: update.gamesPlayed ? now : currentStats.lastPlayedAt
  })
}
