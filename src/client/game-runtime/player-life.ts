import { gameConfig } from "../../shared/game-config"
import type { LifeState, LobbyPlayer, ScoreState } from "../../shared/lobby-types"

export const createEmptyScoreState = (players: LobbyPlayer[]): ScoreState => {
  const scoredPlayers = players
    .map((player) => ({
      ...player,
      score: 0
    }))
    .sort((left, right) => left.username.localeCompare(right.username))

  return {
    teamScore: 0,
    players: scoredPlayers
  }
}

export const createInitialLifeState = (players: LobbyPlayer[]): LifeState => ({
  players: players.map((player) => ({
    ...player,
    lives: gameConfig.playerStartingLives,
    isEliminated: false
  }))
})

export const getLife = (lives: LifeState | undefined, playerId: string) =>
  lives?.players.find((player) => player.id === playerId)

export const isPlayerEliminated = (lives: LifeState | undefined, playerId: string) =>
  getLife(lives, playerId)?.isEliminated ?? false
