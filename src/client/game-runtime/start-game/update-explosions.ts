import type { RenderExplosion } from "../../render/render-game"

export const updateExplosions = (
  explosions: RenderExplosion[],
  incomingExplosions: RenderExplosion[],
  deltaSeconds: number
): RenderExplosion[] => [
  ...explosions
    .map((explosion) => ({
      ...explosion,
      ageSeconds: explosion.ageSeconds + deltaSeconds
    }))
    .filter((explosion) => explosion.ageSeconds < 0.85),
  ...incomingExplosions
]
