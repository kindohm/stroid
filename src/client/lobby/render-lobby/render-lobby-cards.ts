import type { LobbySummary } from "../../../shared/lobby-types"
import { escapeHtml } from "../../app/escape-html"

export const renderLobbyCards = (lobbies: LobbySummary[]) => {
  const cards = lobbies.map((lobby) => `
    <li class="lobby-card">
      <div>
        <strong>${escapeHtml(lobby.slug)}</strong>
        <span>${escapeHtml(lobby.hostUsername)} / ${lobby.playerCount.toLocaleString()} pilot${lobby.playerCount === 1 ? "" : "s"}</span>
      </div>
      <span class="lobby-status ${lobby.gameInProgress ? "is-live" : ""}">
        ${lobby.gameInProgress ? "in progress" : "waiting"}
      </span>
      <button type="button" data-join-slug="${escapeHtml(lobby.slug)}">${lobby.gameInProgress ? "Spectate" : "Join"}</button>
    </li>
  `).join("")

  return cards || `<li class="lobby-empty">no lobbies yet</li>`
}
