import type { AsteroidSize, PowerUpType } from "../../../shared/game-types"

export const asteroidExplosionColorBySize: Record<AsteroidSize, string> = {
  extraLarge: "rgba(255, 244, 166, 0.92)",
  large: "rgba(218, 209, 184, 0.9)",
  medium: "rgba(188, 210, 196, 0.9)",
  small: "rgba(116, 255, 224, 0.86)"
}

export const powerUpExplosionColorByType: Record<PowerUpType, string> = {
  shield: "rgba(116, 255, 224, 0.92)",
  scatterShot: "rgba(255, 244, 166, 0.92)",
  asteroidFreeze: "rgba(155, 183, 255, 0.92)",
  rapidFire: "rgba(255, 159, 67, 0.92)"
}
