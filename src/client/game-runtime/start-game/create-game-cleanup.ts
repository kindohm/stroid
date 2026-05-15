import type { AppState } from "../../app/app-state"

type CreateGameCleanupArgs = {
  onResize: () => void
  state: AppState
}

export const createGameCleanup = ({ onResize, state }: CreateGameCleanupArgs) => () => {
  window.removeEventListener("resize", onResize)
  cancelAnimationFrame(state.animationFrame)
  document.querySelector(".audio-panel")?.remove()
  state.gameAudio?.setThrusting(false)
  state.gameAudio?.destroy()
  state.gameAudio = undefined
  state.keyboard?.destroy()
  state.keyboard = undefined
  state.gameCleanup = undefined
}
