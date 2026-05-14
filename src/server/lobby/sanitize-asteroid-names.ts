import type { AsteroidNamePools, AsteroidNameSize } from "../../shared/lobby-types"

export const sanitizeAsteroidNames = (value: unknown, fallback: AsteroidNamePools): AsteroidNamePools => {
  if (!value || typeof value !== "object") {
    return fallback
  }

  const source = value as Partial<Record<AsteroidNameSize, unknown>>
  const sanitizeList = (size: AsteroidNameSize) => {
    const names = Array.isArray(source[size]) ? source[size] : fallback[size]
    const sanitized = names
      .filter((name): name is string => typeof name === "string")
      .map((name) => name.trim().slice(0, 24))
      .filter((name) => name.length > 0)
      .slice(0, 12)

    return sanitized.length > 0 ? sanitized : fallback[size]
  }

  return {
    extraLarge: sanitizeList("extraLarge"),
    large: sanitizeList("large"),
    medium: sanitizeList("medium"),
    small: sanitizeList("small"),
    boss: sanitizeList("boss")
  }
}
