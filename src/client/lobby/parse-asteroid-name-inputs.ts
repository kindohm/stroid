import type { AsteroidNamePools } from "../../shared/lobby-types"
import { asteroidNameSizes, defaultAsteroidNames } from "./asteroid-name-options"

const parseAsteroidNameList = (value: string) =>
  value
    .split(/[\n,]/)
    .map((name) => name.trim())
    .filter((name) => name.length > 0)

export const parseAsteroidNameInputs = (container: ParentNode): AsteroidNamePools =>
  asteroidNameSizes.reduce((pools, size) => {
    const input = container.querySelector<HTMLTextAreaElement>(`textarea[data-asteroid-size="${size}"]`)
    const names = input ? parseAsteroidNameList(input.value) : []

    return {
      ...pools,
      [size]: names.length > 0 ? names : defaultAsteroidNames[size]
    }
  }, {} as AsteroidNamePools)
