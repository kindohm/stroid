import type { AsteroidNamePools, AsteroidNameSize } from "../../shared/lobby-types"

export const defaultAsteroidNames: AsteroidNamePools = {
  extraLarge: ["Alpha"],
  large: ["Beta"],
  medium: ["Gamma"],
  small: ["Omega"]
}

export const asteroidNameSizes: AsteroidNameSize[] = ["extraLarge", "large", "medium", "small"]

export const asteroidNameLabels: Record<AsteroidNameSize, string> = {
  extraLarge: "extra large",
  large: "large",
  medium: "medium",
  small: "small"
}
