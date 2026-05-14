import type { AsteroidNamePools, AsteroidNameSize, RegularAsteroidNameSize } from "../../shared/lobby-types"

export const defaultAsteroidNames: AsteroidNamePools = {
  extraLarge: ["Alpha"],
  large: ["Beta"],
  medium: ["Gamma"],
  small: ["Omega"],
  boss: ["boss"]
}

export const asteroidNameSizes: AsteroidNameSize[] = ["extraLarge", "large", "medium", "small", "boss"]
export const regularAsteroidNameSizes: RegularAsteroidNameSize[] = ["extraLarge", "large", "medium", "small"]

export const asteroidNameLabels: Record<AsteroidNameSize, string> = {
  extraLarge: "extra large",
  large: "large",
  medium: "medium",
  small: "small",
  boss: "boss"
}
