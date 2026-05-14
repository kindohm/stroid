import type { AppState } from "../../app/app-state"

export const resetLobbyRuntime = (state: AppState) => {
  state.gameCleanup?.()
  cancelAnimationFrame(state.animationFrame)
  state.keyboard?.destroy()
  state.keyboard = undefined
  state.gameAudio?.destroy()
  state.gameAudio = undefined
  state.lobbyConnection?.destroy()
  state.activeGame = undefined
  state.currentLobbySlug = ""
  state.currentLobbyHostId = ""
}
