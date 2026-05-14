import type { AppState } from "../../app/app-state"
import { escapeHtml } from "../../app/escape-html"
import type { LobbyRenderModel } from "./lobby-render-model"
import { renderLobbyCards } from "./render-lobby-cards"
import { renderLobbyShell } from "./render-lobby-shell"

type RenderLobbyBrowserArgs = {
  model: LobbyRenderModel
  render: () => void
  state: AppState
}

export const renderLobbyBrowser = ({ model, render, state }: RenderLobbyBrowserArgs) => {
  renderLobbyShell({
    state,
    connectionStatus: model.connectionStatus,
    body: `
      <div class="lobby-browser-actions">
        <button class="create-lobby-button" type="button" ${model.connectionStatus !== "connected" ? "disabled" : ""}>Create lobby</button>
        <button class="refresh-lobbies-button secondary-button" type="button">Refresh</button>
      </div>
      <section class="lobby-roster" aria-label="Open lobbies">
        <div class="lobby-roster-header">
          <span>available lobbies</span>
          <span>${escapeHtml(model.statusMessage)}</span>
        </div>
        <ul class="lobby-list">${renderLobbyCards(model.lobbies)}</ul>
      </section>
    `
  })

  const createButton = state.app.querySelector<HTMLButtonElement>(".create-lobby-button")
  const refreshButton = state.app.querySelector<HTMLButtonElement>(".refresh-lobbies-button")

  if (!createButton || !refreshButton) {
    throw new Error("Lobby browser failed to render")
  }

  createButton.addEventListener("click", () => {
    state.lobbyConnection?.createLobby()
    model.statusMessage = "creating"
    render()
  })
  refreshButton.addEventListener("click", () => {
    state.lobbyConnection?.listLobbies()
  })
  state.app.querySelectorAll<HTMLButtonElement>("[data-join-slug]").forEach((button) => {
    button.addEventListener("click", () => {
      const slug = button.dataset.joinSlug

      if (slug) {
        state.lobbyConnection?.join(slug)
        model.statusMessage = `joining ${slug}`
        render()
      }
    })
  })
}
