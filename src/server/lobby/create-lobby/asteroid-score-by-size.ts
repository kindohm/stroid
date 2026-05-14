import type { AsteroidSize } from "../../../shared/game-types"

export const asteroidScoreBySize: Record<AsteroidSize, number> = {
  extraLarge: 100,
  large: 100,
  medium: 200,
  small: 300
}
