import {
  createRandomRoomSettings,
  mapSizePresets,
  roomSettingsBounds
} from "../../../shared/room-settings"
import type { AppState } from "../../app/app-state"
import { escapeHtml } from "../../app/escape-html"
import { setRoute } from "../../app/route"
import { saveStoredAsteroidNames } from "../asteroid-name-storage"
import { copyLobbyInvite } from "../copy-lobby-invite"
import { parseAsteroidNameInputs } from "../parse-asteroid-name-inputs"
import { renderAsteroidEditor } from "../render-asteroid-editor"
import { getRoomSettingsFromElement } from "./get-room-settings-from-element"
import type { LobbyRenderModel } from "./lobby-render-model"
import { createPilotLogElement } from "./render-pilot-log"
import { renderLobbyShell } from "./render-lobby-shell"
import { showToast } from "./show-toast"

type RenderRoomArgs = {
  model: LobbyRenderModel
  render: () => void
  state: AppState
}

export const renderRoom = ({ model, render, state }: RenderRoomArgs) => {
  const shareUrl = `${window.location.origin}/lobby/${state.currentLobbySlug}`
  const isHost = model.selfId === state.currentLobbyHostId
  const self = model.lobbyPlayers.find((player) => player.id === model.selfId)
  const allPlayersReady = model.lobbyPlayers.length > 0 && model.lobbyPlayers.every((player) => player.isReady)
  const readyCount = model.lobbyPlayers.filter((player) => player.isReady).length

  renderLobbyShell({
    state,
    connectionStatus: model.connectionStatus,
    body: `
      <section class="room-plate" aria-label="Current lobby">
        <div>
          <span>lobby</span>
          <strong>${escapeHtml(state.currentLobbySlug)}</strong>
        </div>
        <div class="share-row">
          <input class="share-url" readonly value="${escapeHtml(shareUrl)}" aria-label="Share URL" />
          <button class="copy-invite-button secondary-button" type="button">Copy</button>
        </div>
      </section>
      <section class="lobby-roster" aria-label="Lobby players">
        <div class="lobby-roster-header">
          <span>players</span>
          <span>${isHost ? "host controls" : "waiting for host"}</span>
        </div>
        <ul class="player-list"></ul>
        <div class="room-actions">
          <button class="ready-button secondary-button" type="button" ${state.activeGame ? "disabled" : ""}>${self?.isReady ? "Unready" : "Ready"}</button>
          <button class="start-button" type="button" ${!isHost || !allPlayersReady ? "disabled" : ""}>Start</button>
          <button class="leave-lobby-button secondary-button" type="button">Leave</button>
        </div>
        <p class="ready-summary">${readyCount.toLocaleString()} / ${model.lobbyPlayers.length.toLocaleString()} pilots ready</p>
      </section>
      <section class="room-settings" aria-label="Game variant settings">
        <div class="lobby-roster-header">
          <span>game variants</span>
          <button class="randomize-settings-button secondary-button" type="button" ${!isHost || state.activeGame ? "disabled" : ""}>Randomize</button>
        </div>
        <div class="room-settings-grid">
          <label>
            <span>map size</span>
            <select name="mapSize" ${!isHost || state.activeGame ? "disabled" : ""}>
              ${mapSizePresets.map((preset) => `
                <option value="${preset.id}" ${model.roomSettings.mapSize === preset.id ? "selected" : ""}>${preset.label}</option>
              `).join("")}
            </select>
          </label>
          <label>
            <span>asteroid density ${Math.round(model.roomSettings.asteroidDensity * 100)}%</span>
            <input name="asteroidDensity" type="range" min="${roomSettingsBounds.asteroidDensity.min}" max="${roomSettingsBounds.asteroidDensity.max}" step="${roomSettingsBounds.asteroidDensity.step}" value="${model.roomSettings.asteroidDensity}" ${!isHost || state.activeGame ? "disabled" : ""} />
          </label>
          <label>
            <span>player lives</span>
            <input name="playerLives" type="number" min="${roomSettingsBounds.playerLives.min}" max="${roomSettingsBounds.playerLives.max}" step="${roomSettingsBounds.playerLives.step}" value="${model.roomSettings.playerLives}" ${!isHost || state.activeGame ? "disabled" : ""} />
          </label>
          <label>
            <span>max ship speed</span>
            <input name="maxShipSpeed" type="number" min="${roomSettingsBounds.maxShipSpeed.min}" max="${roomSettingsBounds.maxShipSpeed.max}" step="${roomSettingsBounds.maxShipSpeed.step}" value="${model.roomSettings.maxShipSpeed}" ${!isHost || state.activeGame ? "disabled" : ""} />
          </label>
          <label>
            <span>boss interval minutes</span>
            <input name="bossIntervalMinutes" type="number" min="${roomSettingsBounds.bossIntervalMinutes.min}" max="${roomSettingsBounds.bossIntervalMinutes.max}" step="${roomSettingsBounds.bossIntervalMinutes.step}" value="${model.roomSettings.bossIntervalMinutes}" ${!isHost || state.activeGame ? "disabled" : ""} />
          </label>
          <label>
            <span>boss hp per player</span>
            <input name="bossHealthPerPlayer" type="number" min="${roomSettingsBounds.bossHealthPerPlayer.min}" max="${roomSettingsBounds.bossHealthPerPlayer.max}" step="${roomSettingsBounds.bossHealthPerPlayer.step}" value="${model.roomSettings.bossHealthPerPlayer}" ${!isHost || state.activeGame ? "disabled" : ""} />
          </label>
          <label class="settings-toggle">
            <input name="friendlyFire" type="checkbox" ${model.roomSettings.friendlyFire ? "checked" : ""} ${!isHost || state.activeGame ? "disabled" : ""} />
            <span>friendly fire + collisions</span>
          </label>
        </div>
      </section>
      ${renderAsteroidEditor(model.asteroidNames)}
    `
  })

  const playerList = state.app.querySelector<HTMLUListElement>(".player-list")
  const readyButton = state.app.querySelector<HTMLButtonElement>(".ready-button")
  const startButton = state.app.querySelector<HTMLButtonElement>(".start-button")
  const leaveButton = state.app.querySelector<HTMLButtonElement>(".leave-lobby-button")
  const shareInput = state.app.querySelector<HTMLInputElement>(".share-url")
  const copyInviteButton = state.app.querySelector<HTMLButtonElement>(".copy-invite-button")
  const roomSettingsElement = state.app.querySelector<HTMLElement>(".room-settings")
  const randomizeSettingsButton = state.app.querySelector<HTMLButtonElement>(".randomize-settings-button")
  const asteroidNameEditor = state.app.querySelector<HTMLElement>(".asteroid-name-editor")

  if (
    !playerList ||
    !readyButton ||
    !startButton ||
    !leaveButton ||
    !shareInput ||
    !copyInviteButton ||
    !roomSettingsElement ||
    !randomizeSettingsButton ||
    !asteroidNameEditor
  ) {
    throw new Error("Room failed to render")
  }

  playerList.replaceChildren(
    ...model.lobbyPlayers.map((player) => {
      const item = document.createElement("li")
      const swatch = document.createElement("span")
      const name = document.createElement("span")
      const identity = document.createElement("div")
      const ready = document.createElement("span")

      item.className = "player-list-item"
      swatch.className = "player-swatch"
      swatch.style.background = player.color
      identity.className = "player-identity"
      name.textContent = `${player.username}${player.id === model.selfId ? " / you" : ""}${player.id === state.currentLobbyHostId ? " / host" : ""}`
      ready.className = `ready-badge ${player.isReady ? "is-ready" : ""}`
      ready.textContent = player.isReady ? "ready" : "not ready"
      identity.append(name)
      item.append(swatch, identity, ready, createPilotLogElement(player.stats))

      return item
    })
  )
  shareInput.addEventListener("focus", () => {
    shareInput.select()
  })
  copyInviteButton.addEventListener("click", async () => {
    copyInviteButton.disabled = true
    const result = await copyLobbyInvite(shareUrl)

    if (result === "copied") {
      showToast(state.app, "invite copied", "success")
    } else {
      shareInput.focus()
      shareInput.select()
      showToast(
        state.app,
        result === "unsupported" ? "copy unavailable - link selected" : "copy failed - link selected",
        "failure"
      )
    }

    copyInviteButton.disabled = false
  })

  const sendRoomSettings = () => {
    if (!isHost || state.activeGame) {
      return
    }

    model.roomSettings = getRoomSettingsFromElement(roomSettingsElement, model.roomSettings)
    state.lobbyConnection?.setRoomSettings(model.roomSettings)
    render()
  }

  roomSettingsElement.addEventListener("change", sendRoomSettings)
  roomSettingsElement.querySelector<HTMLInputElement>("input[name='asteroidDensity']")?.addEventListener("input", sendRoomSettings)
  randomizeSettingsButton.addEventListener("click", () => {
    model.roomSettings = createRandomRoomSettings()
    state.lobbyConnection?.setRoomSettings(model.roomSettings)
    render()
  })
  startButton.addEventListener("click", () => {
    if (isHost && allPlayersReady) {
      state.lobbyConnection?.startGame()
    }
  })
  readyButton.addEventListener("click", () => {
    state.lobbyConnection?.setReady(!(self?.isReady ?? false))
  })
  leaveButton.addEventListener("click", () => {
    state.lobbyConnection?.leaveLobby()
    setRoute()
    state.currentLobbySlug = ""
    state.currentLobbyHostId = ""
    model.view = "browser"
    state.lobbyConnection?.listLobbies()
    render()
  })
  asteroidNameEditor.addEventListener("change", () => {
    model.asteroidNames = parseAsteroidNameInputs(asteroidNameEditor)
    saveStoredAsteroidNames(model.asteroidNames)
    state.lobbyConnection?.setAsteroidNames(model.asteroidNames)
    render()
  })
}
