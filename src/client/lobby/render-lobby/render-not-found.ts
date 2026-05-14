import type { AppState } from "../../app/app-state"
import { escapeHtml } from "../../app/escape-html"
import { setRoute } from "../../app/route"
import type { LobbyRenderModel } from "./lobby-render-model"
import { renderLobbyShell } from "./render-lobby-shell"

type RenderNotFoundArgs = {
  model: LobbyRenderModel
  render: () => void
  state: AppState
}

export const renderNotFound = ({ model, render, state }: RenderNotFoundArgs) => {
  renderLobbyShell({
    state,
    connectionStatus: model.connectionStatus,
    body: `
      <section class="not-found-panel">
        <p class="signal">NO SIGNAL</p>
        <h2>Lobby not found</h2>
        <p>${escapeHtml(model.statusMessage)}</p>
        <button class="back-to-lobbies-button" type="button">Back to lobbies</button>
      </section>
    `
  })

  const button = state.app.querySelector<HTMLButtonElement>(".back-to-lobbies-button")

  button?.addEventListener("click", () => {
    model.pendingSlug = undefined
    setRoute()
    model.view = state.currentUsername ? "browser" : "username"
    state.lobbyConnection?.listLobbies()
    render()
  })
}
