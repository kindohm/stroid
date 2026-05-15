import type { ScoreState } from "../../../shared/lobby-types"
import type { AppState } from "../../app/app-state"
import { createGameAudio } from "../../audio/create-game-audio"
import { renderAudioControls } from "../../audio/render-audio-controls"
import { updatePlayerStats } from "../../stats/player-stats"
import { renderPlayerHeader } from "../../ui/render-player-header"
import { renderScorePanel } from "../../ui/render-score-panel"

type RenderGameShellArgs = {
  isSpectator: boolean
  scores: ScoreState
  state: AppState
}

export const renderGameShell = ({ isSpectator, scores, state }: RenderGameShellArgs) => {
  state.app.innerHTML = `
    <canvas class="game-canvas" aria-label="Stroid game map"></canvas>
    <aside class="score-panel" aria-label="Scores"></aside>
    <aside class="control-key" aria-label="Keyboard controls">
      <div class="control-key-title">flight keys</div>
      <dl>
        <div>
          <dt><kbd>↑</kbd></dt>
          <dd>thrust</dd>
        </div>
        <div>
          <dt><kbd>←</kbd><kbd>→</kbd></dt>
          <dd>turn</dd>
        </div>
        <div>
          <dt><kbd>Space</kbd></dt>
          <dd>fire</dd>
        </div>
      </dl>
    </aside>
  `
  renderPlayerHeader(state)
  renderScorePanel(scores)
  if (!isSpectator) {
    updatePlayerStats({
      gamesPlayed: 1
    })
  }
  state.gameAudio?.destroy()
  state.gameAudio = createGameAudio()
  renderAudioControls(state.gameAudio)

  const canvas = state.app.querySelector<HTMLCanvasElement>("canvas")
  const context = canvas?.getContext("2d", {
    alpha: false,
    desynchronized: true
  })

  if (!canvas || !context) {
    throw new Error("Canvas failed to start")
  }

  return {
    canvas,
    context
  }
}
