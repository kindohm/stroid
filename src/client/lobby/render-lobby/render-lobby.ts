import type { AppState } from "../../app/app-state"
import { getRouteLobbySlug } from "../../app/route"
import { createLobbyConnection } from "../create-lobby-connection"
import { createLobbyMessageHandlers } from "./create-lobby-message-handlers"
import { createLobbyRenderModel } from "./lobby-render-model"
import { renderLobbyBrowser } from "./render-lobby-browser"
import { renderNotFound } from "./render-not-found"
import { renderRoom } from "./render-room"
import { renderUsernameGate } from "./render-username-gate"
import { resetLobbyRuntime } from "./reset-lobby-runtime"

export const renderLobby = (state: AppState) => {
  resetLobbyRuntime(state)

  const model = createLobbyRenderModel(state.currentUsername, getRouteLobbySlug())

  const render = () => {
    if (model.view === "username") {
      renderUsernameGate({ model, render, state })
      return
    }

    if (model.view === "room") {
      renderRoom({ model, render, state })
      return
    }

    if (model.view === "notFound") {
      renderNotFound({ model, render, state })
      return
    }

    renderLobbyBrowser({ model, render, state })
  }

  state.lobbyConnection = createLobbyConnection(createLobbyMessageHandlers({
    model,
    render,
    state
  }))

  render()
}
