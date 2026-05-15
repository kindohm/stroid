import { createPowerUp } from "../../game/create-power-up"
import { updatePowerUps } from "../../game/update-power-ups"
import { gameConfig } from "../../shared/game-config"
import type { GravityWell, PowerUp } from "../../shared/game-types"
import { createGameWorld, type RoomSettings } from "../../shared/room-settings"

type CreateLobbyPowerUpsArgs = {
  getSettings: () => RoomSettings
  getGravityWells?: () => GravityWell[]
  canSpawn?: () => boolean
  onChanged: (powerUps: PowerUp[]) => void
}

export const createLobbyPowerUps = ({
  getSettings,
  getGravityWells = () => [],
  canSpawn = () => true,
  onChanged
}: CreateLobbyPowerUpsArgs) => {
  let powerUps: PowerUp[] = []
  let powerUpId = 0
  let powerUpInterval: ReturnType<typeof setInterval> | undefined
  let lastPowerUpTick = Date.now()
  let nextSpawnAt = Date.now() + gameConfig.powerUpSpawnIntervalMs

  const createPowerUpId = () => {
    powerUpId += 1
    return `power-up-${powerUpId}`
  }

  const spawnPowerUp = () => {
    if (!canSpawn() || powerUps.length >= gameConfig.powerUpMaxActive) {
      nextSpawnAt = Date.now() + gameConfig.powerUpSpawnIntervalMs
      return
    }

    powerUps = [...powerUps, createPowerUp(createPowerUpId(), createGameWorld(getSettings()), Math.random)]
    nextSpawnAt = Date.now() + gameConfig.powerUpSpawnIntervalMs
  }

  const start = () => {
    onChanged(powerUps)

    if (powerUpInterval) {
      return
    }

    lastPowerUpTick = Date.now()
    nextSpawnAt = lastPowerUpTick + gameConfig.powerUpSpawnIntervalMs
    powerUpInterval = setInterval(() => {
      const now = Date.now()
      const deltaSeconds = Math.min(0.1, (now - lastPowerUpTick) / 1000)

      lastPowerUpTick = now
      powerUps = updatePowerUps(powerUps, deltaSeconds, createGameWorld(getSettings()), getGravityWells())

      if (now >= nextSpawnAt) {
        spawnPowerUp()
      }

      onChanged(powerUps)
    }, gameConfig.asteroidStateBroadcastIntervalMs)
  }

  const stop = () => {
    if (powerUpInterval) {
      clearInterval(powerUpInterval)
      powerUpInterval = undefined
    }
  }

  const reset = () => {
    stop()
    powerUps = []
    powerUpId = 0
    lastPowerUpTick = Date.now()
    nextSpawnAt = lastPowerUpTick + gameConfig.powerUpSpawnIntervalMs
  }

  const destroy = (powerUpIdToDestroy: string) => {
    const powerUp = powerUps.find((nextPowerUp) => nextPowerUp.id === powerUpIdToDestroy)

    if (!powerUp) {
      return undefined
    }

    powerUps = powerUps.filter((nextPowerUp) => nextPowerUp.id !== powerUpIdToDestroy)
    onChanged(powerUps)

    return powerUp
  }

  return {
    destroy,
    getPowerUps: () => powerUps,
    reset,
    start,
    stop
  }
}
