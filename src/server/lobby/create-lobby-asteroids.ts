import { createBorderAsteroid } from "../../game/create-border-asteroid"
import { getAsteroidSpawnTarget } from "../../game/get-asteroid-spawn-target"
import { getAsteroidSpeedMultiplier } from "../../game/get-asteroid-speed-multiplier"
import { splitAsteroid } from "../../game/split-asteroid"
import { updateAsteroids } from "../../game/update-asteroids"
import { gameConfig } from "../../shared/game-config"
import type { Asteroid, GameWorld } from "../../shared/game-types"
import type { AsteroidNamePools } from "../../shared/lobby-types"
import { asteroidNameSizeByAsteroidSize } from "./asteroid-name-size-by-asteroid-size"

type CreateLobbyAsteroidsArgs = {
  getAsteroidNames: () => AsteroidNamePools
  isFrozen?: () => boolean
  onChanged: (asteroids: Asteroid[]) => void
}

const world: GameWorld = {
  width: gameConfig.mapTilesWide * gameConfig.tileSize,
  height: gameConfig.mapTilesTall * gameConfig.tileSize
}

export const createLobbyAsteroids = ({
  getAsteroidNames,
  isFrozen = () => false,
  onChanged
}: CreateLobbyAsteroidsArgs) => {
  let asteroids: Asteroid[] = []
  let asteroidsSpawned = 0
  let asteroidsDestroyed = 0
  let asteroidId = 0
  let asteroidInterval: ReturnType<typeof setInterval> | undefined
  let lastAsteroidTick = Date.now()

  const createAsteroidId = () => {
    asteroidId += 1
    return `asteroid-${asteroidId}`
  }

  const nameAsteroid = (asteroid: Asteroid): Asteroid => {
    const asteroidNames = getAsteroidNames()
    const names = asteroidNames[asteroidNameSizeByAsteroidSize[asteroid.size]]
    const name = names[Math.floor(Math.random() * names.length)]

    return {
      ...asteroid,
      name
    }
  }

  const createAsteroid = () => {
    const speedMultiplier = getAsteroidSpeedMultiplier(asteroidsSpawned, asteroidsDestroyed)
    asteroidsSpawned += 1
    return nameAsteroid(createBorderAsteroid(createAsteroidId(), world, Math.random, speedMultiplier))
  }

  const fillAsteroidTarget = () => {
    const target = getAsteroidSpawnTarget(asteroidsSpawned, asteroidsDestroyed)

    while (asteroids.length < target) {
      asteroids = [...asteroids, createAsteroid()]
    }
  }

  const start = () => {
    fillAsteroidTarget()
    onChanged(asteroids)

    if (asteroidInterval) {
      return
    }

    lastAsteroidTick = Date.now()
    asteroidInterval = setInterval(() => {
      const now = Date.now()
      const deltaSeconds = Math.min(0.1, (now - lastAsteroidTick) / 1000)

      lastAsteroidTick = now
      if (!isFrozen()) {
        asteroids = updateAsteroids(asteroids, deltaSeconds, world)
      }
      fillAsteroidTarget()
      onChanged(asteroids)
    }, gameConfig.asteroidStateBroadcastIntervalMs)
  }

  const stop = () => {
    if (asteroidInterval) {
      clearInterval(asteroidInterval)
      asteroidInterval = undefined
    }
  }

  const reset = () => {
    stop()
    asteroids = []
    asteroidsSpawned = 0
    asteroidsDestroyed = 0
    asteroidId = 0
    lastAsteroidTick = Date.now()
  }

  const destroy = (asteroidIdToDestroy: string) => {
    const asteroid = asteroids.find((nextAsteroid) => nextAsteroid.id === asteroidIdToDestroy)

    if (!asteroid) {
      return undefined
    }

    asteroids = asteroids.filter((nextAsteroid) => nextAsteroid.id !== asteroidIdToDestroy)
    asteroidsDestroyed += 1
    const children = splitAsteroid(
      asteroid,
      createAsteroidId,
      Math.random,
      getAsteroidSpeedMultiplier(asteroidsSpawned, asteroidsDestroyed)
    ).map(nameAsteroid)

    asteroidsSpawned += children.length
    asteroids = [...asteroids, ...children]
    fillAsteroidTarget()

    return asteroid
  }

  return {
    destroy,
    getAsteroids: () => asteroids,
    reset,
    start,
    stop
  }
}
