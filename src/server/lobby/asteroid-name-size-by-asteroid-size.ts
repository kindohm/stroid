import type { AsteroidSize } from "../../shared/game-types"
import type { AsteroidNameSize } from "../../shared/lobby-types"

export const asteroidNameSizeByAsteroidSize: Record<AsteroidSize, AsteroidNameSize> = {
  extraLarge: "extraLarge",
  large: "large",
  medium: "medium",
  small: "small"
}
