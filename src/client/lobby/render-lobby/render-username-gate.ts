import type { AppState } from "../../app/app-state"
import { escapeHtml } from "../../app/escape-html"
import type { LobbyRenderModel } from "./lobby-render-model"
import { renderLobbyShell } from "./render-lobby-shell"

type RenderUsernameGateArgs = {
  model: LobbyRenderModel
  render: () => void
  state: AppState
}

export const renderUsernameGate = ({ model, render: _render, state }: RenderUsernameGateArgs) => {
  renderLobbyShell({
    state,
    connectionStatus: model.connectionStatus,
    body: `
      <form class="join-form username-form">
        <label>
          <span>username</span>
          <input name="username" autocomplete="nickname" maxlength="18" value="${escapeHtml(state.currentUsername)}" />
        </label>
        <button class="join-button" type="submit" disabled>Continue</button>
      </form>
      <p class="lobby-note">${escapeHtml(model.statusMessage)}</p>
    `
  })

  const form = state.app.querySelector<HTMLFormElement>(".username-form")
  const input = state.app.querySelector<HTMLInputElement>("input[name='username']")
  const button = state.app.querySelector<HTMLButtonElement>(".join-button")

  if (!form || !input || !button) {
    throw new Error("Username gate failed to render")
  }

  const update = () => {
    button.disabled = input.value.trim().length === 0 || model.connectionStatus !== "connected"
  }

  input.focus()
  input.addEventListener("input", update)
  form.addEventListener("submit", (event) => {
    event.preventDefault()

    const username = input.value.trim()

    if (username.length === 0 || model.connectionStatus !== "connected") {
      return
    }

    state.lobbyConnection?.setUsername(username)
    button.disabled = true
  })
  update()
}
