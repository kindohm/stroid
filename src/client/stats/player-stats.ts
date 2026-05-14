import type { AsteroidSize, PowerUpType } from "../../shared/game-types"
import type { PlayerDeathCause } from "../../shared/lobby-types"
import { createDefaultPlayerStats, sanitizePlayerStats, type PlayerStats } from "../../shared/player-stats"

const playerStatsStorageKey = "stroid.playerStats"

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
