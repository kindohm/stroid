import { gameConfig } from "./game-config"
import type { GameWorld } from "./game-types"

export const mapSizePresets = [
  {
    id: "tiny",
    label: "Tiny",
    tiles: 20
  },
  {
    id: "small",
    label: "Small",
    tiles: 35
  },
  {
    id: "standard",
    label: "Standard",
    tiles: 50
  },
  {
    id: "huge",
    label: "Huge",
    tiles: 70
  }
] as const

export type MapSizePreset = typeof mapSizePresets[number]["id"]

export type RoomSettings = {
  mapSize: MapSizePreset
  asteroidDensity: number
  playerLives: number
  friendlyFire: boolean
  maxShipSpeed: number
  bossIntervalMinutes: number
  bossHealthPerPlayer: number
}

export const defaultRoomSettings: RoomSettings = {
  mapSize: "standard",
  asteroidDensity: 0.5,
  playerLives: gameConfig.playerStartingLives,
  friendlyFire: false,
  maxShipSpeed: gameConfig.maxSpeed,
  bossIntervalMinutes: 1.5,
  bossHealthPerPlayer: 50
}

export const roomSettingsBounds = {
  asteroidDensity: {
    min: 0,
    max: 1,
    step: 0.05
  },
  playerLives: {
    min: 1,
    max: 9,
    step: 1
  },
  maxShipSpeed: {
    min: 800,
    max: 2400,
    step: 20
  },
  bossIntervalMinutes: {
    min: 1,
    max: 20,
    step: 0.5
  },
  bossHealthPerPlayer: {
    min: 5,
    max: 100,
    step: 5
  }
} as const

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const isMapSizePreset = (value: unknown): value is MapSizePreset =>
  mapSizePresets.some((preset) => preset.id === value)

const sanitizeNumber = (
  value: unknown,
  fallback: number,
  min: number,
  max: number,
  step?: number
) => {
  const numberValue = typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback
  const clamped = clamp(numberValue, min, max)

  if (!step) {
    return clamped
  }

  return Number((Math.round(clamped / step) * step).toFixed(2))
}

export const sanitizeRoomSettings = (value: unknown): RoomSettings => {
  if (!value || typeof value !== "object") {
    return defaultRoomSettings
  }

  const source = value as Partial<Record<keyof RoomSettings, unknown>>

  return {
    mapSize: isMapSizePreset(source.mapSize) ? source.mapSize : defaultRoomSettings.mapSize,
    asteroidDensity: sanitizeNumber(
      source.asteroidDensity,
      defaultRoomSettings.asteroidDensity,
      roomSettingsBounds.asteroidDensity.min,
      roomSettingsBounds.asteroidDensity.max,
      roomSettingsBounds.asteroidDensity.step
    ),
    playerLives: sanitizeNumber(
      source.playerLives,
      defaultRoomSettings.playerLives,
      roomSettingsBounds.playerLives.min,
      roomSettingsBounds.playerLives.max,
      roomSettingsBounds.playerLives.step
    ),
    friendlyFire: source.friendlyFire === true,
    maxShipSpeed: sanitizeNumber(
      source.maxShipSpeed,
      defaultRoomSettings.maxShipSpeed,
      roomSettingsBounds.maxShipSpeed.min,
      roomSettingsBounds.maxShipSpeed.max,
      roomSettingsBounds.maxShipSpeed.step
    ),
    bossIntervalMinutes: sanitizeNumber(
      source.bossIntervalMinutes,
      defaultRoomSettings.bossIntervalMinutes,
      roomSettingsBounds.bossIntervalMinutes.min,
      roomSettingsBounds.bossIntervalMinutes.max,
      roomSettingsBounds.bossIntervalMinutes.step
    ),
    bossHealthPerPlayer: sanitizeNumber(
      source.bossHealthPerPlayer,
      defaultRoomSettings.bossHealthPerPlayer,
      roomSettingsBounds.bossHealthPerPlayer.min,
      roomSettingsBounds.bossHealthPerPlayer.max,
      roomSettingsBounds.bossHealthPerPlayer.step
    )
  }
}

export const createRandomRoomSettings = (random: () => number = Math.random): RoomSettings => {
  const mapSize = mapSizePresets[Math.floor(random() * mapSizePresets.length)]?.id ?? "standard"
  const densityStep = roomSettingsBounds.asteroidDensity.step
  const speedStep = roomSettingsBounds.maxShipSpeed.step
  const speedSteps =
    (roomSettingsBounds.maxShipSpeed.max - roomSettingsBounds.maxShipSpeed.min) / speedStep

  return {
    mapSize,
    asteroidDensity: Math.round(random() / densityStep) * densityStep,
    playerLives: Math.floor(
      roomSettingsBounds.playerLives.min +
        random() * (roomSettingsBounds.playerLives.max - roomSettingsBounds.playerLives.min + 1)
    ),
    friendlyFire: random() >= 0.5,
    maxShipSpeed: roomSettingsBounds.maxShipSpeed.min + Math.floor(random() * (speedSteps + 1)) * speedStep,
    bossIntervalMinutes: Math.floor(
      roomSettingsBounds.bossIntervalMinutes.min +
        random() * (roomSettingsBounds.bossIntervalMinutes.max - roomSettingsBounds.bossIntervalMinutes.min + 1)
    ),
    bossHealthPerPlayer: roomSettingsBounds.bossHealthPerPlayer.min +
      Math.floor(
        random() *
          ((roomSettingsBounds.bossHealthPerPlayer.max - roomSettingsBounds.bossHealthPerPlayer.min) /
            roomSettingsBounds.bossHealthPerPlayer.step + 1)
      ) * roomSettingsBounds.bossHealthPerPlayer.step
  }
}

export const createGameWorld = (settings: RoomSettings = defaultRoomSettings): GameWorld => {
  const preset = mapSizePresets.find((nextPreset) => nextPreset.id === settings.mapSize) ?? mapSizePresets[2]
  const size = preset.tiles * gameConfig.tileSize

  return {
    width: size,
    height: size
  }
}

export const getAsteroidDensityTarget = (
  settings: RoomSettings,
  asteroidsSpawned: number,
  asteroidsDestroyed: number
) => {
  const density = clamp(settings.asteroidDensity, 0, 1)
  const minimumTarget = 1
  const initialTarget = minimumTarget + Math.round(density * (gameConfig.initialAsteroidTarget - minimumTarget))
  const maxTarget = Math.max(initialTarget, Math.round(minimumTarget + density * (gameConfig.maxAsteroidTarget - minimumTarget)))

  return Math.min(
    maxTarget,
    initialTarget + Math.floor((asteroidsSpawned + asteroidsDestroyed) / gameConfig.asteroidSpawnPressureStep)
  )
}
