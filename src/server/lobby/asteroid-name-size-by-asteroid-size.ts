import type { AsteroidSize } from "../../shared/game-types"
import type { RegularAsteroidNameSize } from "../../shared/lobby-types"

export const asteroidNameSizeByAsteroidSize: Record<AsteroidSize, RegularAsteroidNameSize> = {
  extraLarge: "extraLarge",
  large: "large",
  medium: "medium",
  small: "small"
}
