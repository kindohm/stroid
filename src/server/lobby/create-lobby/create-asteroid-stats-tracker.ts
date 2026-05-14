import type { Asteroid } from "../../../shared/game-types"
import type { AsteroidStatsState, LobbyPlayer, PlayerAsteroidStats } from "../../../shared/lobby-types"
import { asteroidNameSizeByAsteroidSize } from "../asteroid-name-size-by-asteroid-size"

const createEmptyAsteroidStats = (player: LobbyPlayer): PlayerAsteroidStats => ({
  ...player,
  destroyedBySize: {
    extraLarge: 0,
    large: 0,
    medium: 0,
    small: 0
  },
  destroyedNamesBySize: {
    extraLarge: {},
    large: {},
    medium: {},
    small: {}
  }
})

export const createAsteroidStatsTracker = () => {
  const asteroidStatsByClientId = new Map<string, PlayerAsteroidStats>()

  return {
    clear: () => asteroidStatsByClientId.clear(),
    createForPlayers: (players: LobbyPlayer[]) => {
      players.forEach((player) => {
        asteroidStatsByClientId.set(player.id, createEmptyAsteroidStats(player))
      })
    },
    getState: (players: LobbyPlayer[]): AsteroidStatsState => ({
      players: players.map((player) => asteroidStatsByClientId.get(player.id) ?? createEmptyAsteroidStats(player))
    }),
    recordDestroyed: (player: LobbyPlayer | undefined, asteroid: Asteroid) => {
      if (!player) {
        return
      }

      const size = asteroidNameSizeByAsteroidSize[asteroid.size]
      const stats = asteroidStatsByClientId.get(player.id) ?? createEmptyAsteroidStats(player)
      const name = asteroid.name ?? "unnamed"

      asteroidStatsByClientId.set(player.id, {
        ...stats,
        username: player.username,
        color: player.color,
        destroyedBySize: {
          ...stats.destroyedBySize,
          [size]: stats.destroyedBySize[size] + 1
        },
        destroyedNamesBySize: {
          ...stats.destroyedNamesBySize,
          [size]: {
            ...stats.destroyedNamesBySize[size],
            [name]: (stats.destroyedNamesBySize[size][name] ?? 0) + 1
          }
        }
      })
    }
  }
}
