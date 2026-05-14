import type { AppState } from "../../app/app-state"
import { renderPlayerHeader } from "../../ui/render-player-header"

type RenderLobbyShellArgs = {
  state: AppState
  body: string
  connectionStatus: "connected" | "connecting" | "disconnected"
}

export const renderLobbyShell = ({ state, body, connectionStatus }: RenderLobbyShellArgs) => {
  state.app.innerHTML = `
    <main class="lobby-shell">
      <section class="lobby-panel lobby-panel-wide">
        <div class="lobby-title-row">
          <div>
            <p class="signal">STROID / ROOM CONTROL</p>
            <h1>Stroid</h1>
          </div>
          <span class="connection-status">${connectionStatus}</span>
        </div>
        ${body}
      </section>
    </main>
  `
  renderPlayerHeader(state)
}
