import type { AppState } from "../../app/app-state"
import { getLife } from "../../game-runtime/player-life"
import { renderScorePanel } from "../../ui/render-score-panel"
import type { LobbyRenderModel } from "./lobby-render-model"

export const updateActiveGameFromLobbyState = (state: AppState, model: LobbyRenderModel) => {
  if (!state.activeGame) {
    return
  }

  const previousScores = state.activeGame.scores.players

  state.activeGame.players = model.lobbyPlayers
  state.activeGame.scores = {
    teamScore: state.activeGame.scores.teamScore,
    players: model.lobbyPlayers
      .map((player) => ({
        ...player,
        score: previousScores.find((score) => score.id === player.id)?.score ?? 0
      }))
      .sort((left, right) => right.score - left.score || left.username.localeCompare(right.username))
  }
  state.activeGame.lives = {
    players: model.lobbyPlayers.map((player) => ({
      ...player,
      lives: getLife(state.activeGame?.lives, player.id)?.lives ?? model.roomSettings.playerLives,
      isEliminated: getLife(state.activeGame?.lives, player.id)?.isEliminated ?? false
    }))
  }
  state.activeGame.settings = model.roomSettings
  renderScorePanel(state.activeGame.scores)
}
