import type { ActivePowerUpEffect, PowerUpType } from "../../../shared/game-types"

export const createPowerUpEffectStore = () => {
  const powerUpEffectsByClientId = new Map<string, Map<PowerUpType, number>>()

  const getEffects = (): ActivePowerUpEffect[] => {
    const now = Date.now()

    return [...powerUpEffectsByClientId.entries()].flatMap(([playerId, effectsByType]) =>
      [...effectsByType.entries()]
        .filter(([, expiresAt]) => expiresAt > now)
        .map(([type, expiresAt]) => ({
          playerId,
          type,
          expiresAt
        }))
    )
  }

  return {
    clear: () => powerUpEffectsByClientId.clear(),
    deletePlayer: (clientId: string) => powerUpEffectsByClientId.delete(clientId),
    expire: () => {
      const now = Date.now()
      let changed = false

      powerUpEffectsByClientId.forEach((effectsByType, clientId) => {
        effectsByType.forEach((expiresAt, type) => {
          if (expiresAt <= now) {
            effectsByType.delete(type)
            changed = true
          }
        })

        if (effectsByType.size === 0) {
          powerUpEffectsByClientId.delete(clientId)
        }
      })

      return changed
    },
    getEffects,
    hasActiveAsteroidFreeze: () => getEffects().some((effect) => effect.type === "asteroidFreeze"),
    setEffect: (clientId: string, type: PowerUpType, expiresAt: number) => {
      const effectsByType = powerUpEffectsByClientId.get(clientId) ?? new Map<PowerUpType, number>()

      effectsByType.set(type, expiresAt)
      powerUpEffectsByClientId.set(clientId, effectsByType)
    }
  }
}
