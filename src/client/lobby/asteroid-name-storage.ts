import type { AsteroidNamePools, AsteroidNameSize } from "../../shared/lobby-types"
import { asteroidNameSizes, defaultAsteroidNames } from "./asteroid-name-options"

const asteroidNameStorageKey = "stroid.asteroidNames"

const sanitizeAsteroidNamePools = (value: unknown): AsteroidNamePools | undefined => {
  if (!value || typeof value !== "object") {
    return undefined
  }

  const source = value as Partial<Record<AsteroidNameSize, unknown>>

  return asteroidNameSizes.reduce((pools, size) => {
    const names = Array.isArray(source[size])
      ? source[size]
          .filter((name): name is string => typeof name === "string")
          .map((name) => name.trim())
          .filter((name) => name.length > 0)
      : []

    return {
      ...pools,
      [size]: names.length > 0 ? names : defaultAsteroidNames[size]
    }
  }, {} as AsteroidNamePools)
}

export const loadStoredAsteroidNames = (): AsteroidNamePools | undefined => {
  try {
    const stored = localStorage.getItem(asteroidNameStorageKey)

    if (!stored) {
      return undefined
    }

    return sanitizeAsteroidNamePools(JSON.parse(stored))
  } catch {
    return undefined
  }
}

export const saveStoredAsteroidNames = (asteroidNames: AsteroidNamePools) => {
  try {
    localStorage.setItem(asteroidNameStorageKey, JSON.stringify(asteroidNames))
  } catch {
    // Local storage is best-effort; the live lobby should keep working without it.
  }
}
