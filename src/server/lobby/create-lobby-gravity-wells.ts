import { createGravityWell } from "../../game/create-gravity-well"
import { updateGravityWells } from "../../game/update-gravity-wells"
import { gameConfig } from "../../shared/game-config"
import type { GravityWell } from "../../shared/game-types"
import { createGameWorld, type RoomSettings } from "../../shared/room-settings"

type CreateLobbyGravityWellsArgs = {
  getSettings: () => RoomSettings
  canSpawn?: () => boolean
  onChanged: (gravityWells: GravityWell[]) => void
}

export const createLobbyGravityWells = ({
  getSettings,
  canSpawn = () => true,
  onChanged
}: CreateLobbyGravityWellsArgs) => {
  let gravityWells: GravityWell[] = []
  let gravityWellId = 0
  let gravityWellInterval: ReturnType<typeof setInterval> | undefined
  let lastGravityWellTick = Date.now()
  let nextSpawnAt = Date.now() + gameConfig.gravityWellSpawnIntervalMs

  const createGravityWellId = () => {
    gravityWellId += 1
    return `gravity-well-${gravityWellId}`
  }

  const spawnGravityWell = () => {
    if (!canSpawn() || gravityWells.length >= gameConfig.gravityWellMaxActive) {
      nextSpawnAt = Date.now() + gameConfig.gravityWellSpawnIntervalMs
      return
    }

    gravityWells = [...gravityWells, createGravityWell(createGravityWellId(), createGameWorld(getSettings()), Math.random)]
    nextSpawnAt = Date.now() + gameConfig.gravityWellSpawnIntervalMs
  }

  const start = () => {
    onChanged(gravityWells)

    if (gravityWellInterval) {
      return
    }

    lastGravityWellTick = Date.now()
    nextSpawnAt = lastGravityWellTick + gameConfig.gravityWellSpawnIntervalMs
    gravityWellInterval = setInterval(() => {
      const now = Date.now()
      const deltaSeconds = Math.min(0.1, (now - lastGravityWellTick) / 1000)

      lastGravityWellTick = now
      gravityWells = updateGravityWells(gravityWells, deltaSeconds, createGameWorld(getSettings()))

      if (now >= nextSpawnAt) {
        spawnGravityWell()
      }

      onChanged(gravityWells)
    }, gameConfig.asteroidStateBroadcastIntervalMs)
  }

  const stop = () => {
    if (gravityWellInterval) {
      clearInterval(gravityWellInterval)
      gravityWellInterval = undefined
    }
  }

  const reset = () => {
    stop()
    gravityWells = []
    gravityWellId = 0
    lastGravityWellTick = Date.now()
    nextSpawnAt = lastGravityWellTick + gameConfig.gravityWellSpawnIntervalMs
  }

  return {
    getGravityWells: () => gravityWells,
    reset,
    start,
    stop
  }
}
