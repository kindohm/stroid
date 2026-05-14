import type { AsteroidNamePools, LobbyPlayer, LobbySummary } from "../../shared/lobby-types"
import {
  createRandomRoomSettings,
  defaultRoomSettings,
  mapSizePresets,
  roomSettingsBounds,
  sanitizeRoomSettings,
  type RoomSettings
} from "../../shared/room-settings"
import type { AppState } from "../app/app-state"
import { escapeHtml } from "../app/escape-html"
import { getRouteLobbySlug, setRoute } from "../app/route"
import { getLife } from "../game-runtime/player-life"
import { startGame } from "../game-runtime/start-game"
import { renderGameOver } from "../ui/render-game-over"
import { renderPlayerHeader } from "../ui/render-player-header"
import { renderScorePanel } from "../ui/render-score-panel"
import { defaultAsteroidNames } from "./asteroid-name-options"
import { saveStoredAsteroidNames } from "./asteroid-name-storage"
import { copyLobbyInvite } from "./copy-lobby-invite"
import { createLobbyConnection } from "./create-lobby-connection"
import { parseAsteroidNameInputs } from "./parse-asteroid-name-inputs"
import { renderAsteroidEditor } from "./render-asteroid-editor"

type LobbyView = "username" | "browser" | "room" | "notFound"

const asteroidExplosionColorBySize = {
  extraLarge: "rgba(255, 244, 166, 0.92)",
  large: "rgba(218, 209, 184, 0.9)",
  medium: "rgba(188, 210, 196, 0.9)",
  small: "rgba(116, 255, 224, 0.86)"
}

const powerUpExplosionColorByType = {
  shield: "rgba(116, 255, 224, 0.92)",
  scatterShot: "rgba(255, 244, 166, 0.92)",
  asteroidFreeze: "rgba(155, 183, 255, 0.92)"
}

const showToast = (app: HTMLElement, message: string, tone: "success" | "failure") => {
  document.querySelector(".toast")?.remove()

  const toast = document.createElement("div")

  toast.className = `toast toast-${tone}`
  toast.setAttribute("role", "status")
  toast.textContent = message
  app.append(toast)
  window.setTimeout(() => toast.remove(), 2200)
}

export const renderLobby = (state: AppState) => {
  state.gameCleanup?.()
  cancelAnimationFrame(state.animationFrame)
  state.keyboard?.destroy()
  state.keyboard = undefined
  state.gameAudio?.destroy()
  state.gameAudio = undefined
  state.lobbyConnection?.destroy()

  const directSlug = getRouteLobbySlug()
  let asteroidNames: AsteroidNamePools = defaultAsteroidNames
  let roomSettings: RoomSettings = defaultRoomSettings
  let connectionStatus: "connected" | "connecting" | "disconnected" = "connecting"
  let selfId = ""
  let lobbyPlayers: LobbyPlayer[] = []
  let lobbies: LobbySummary[] = []
  let pendingSlug = directSlug
  let view: LobbyView = state.currentUsername ? "browser" : "username"
  let statusMessage = directSlug ? `join ${directSlug}` : "choose signal"
  state.activeGame = undefined
  state.currentLobbySlug = ""
  state.currentLobbyHostId = ""

  const renderShell = (body: string) => {
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

  const renderUsernameGate = () => {
    renderShell(`
      <form class="join-form username-form">
        <label>
          <span>username</span>
          <input name="username" autocomplete="nickname" maxlength="18" value="${escapeHtml(state.currentUsername)}" />
        </label>
        <button class="join-button" type="submit" disabled>Continue</button>
      </form>
      <p class="lobby-note">${escapeHtml(statusMessage)}</p>
    `)

    const form = state.app.querySelector<HTMLFormElement>(".username-form")
    const input = state.app.querySelector<HTMLInputElement>("input[name='username']")
    const button = state.app.querySelector<HTMLButtonElement>(".join-button")

    if (!form || !input || !button) {
      throw new Error("Username gate failed to render")
    }

    const update = () => {
      button.disabled = input.value.trim().length === 0 || connectionStatus !== "connected"
    }

    input.focus()
    input.addEventListener("input", update)
    form.addEventListener("submit", (event) => {
      event.preventDefault()

      const username = input.value.trim()

      if (username.length === 0 || connectionStatus !== "connected") {
        return
      }

      state.lobbyConnection?.setUsername(username)
      button.disabled = true
    })
    update()
  }

  const renderLobbyCards = () => {
    const cards = lobbies.map((lobby) => `
      <li class="lobby-card">
        <div>
          <strong>${escapeHtml(lobby.slug)}</strong>
          <span>${escapeHtml(lobby.hostUsername)} / ${lobby.playerCount.toLocaleString()} pilot${lobby.playerCount === 1 ? "" : "s"}</span>
        </div>
        <span class="lobby-status ${lobby.gameInProgress ? "is-live" : ""}">
          ${lobby.gameInProgress ? "in progress" : "waiting"}
        </span>
        <button type="button" data-join-slug="${escapeHtml(lobby.slug)}" ${lobby.gameInProgress ? "disabled" : ""}>Join</button>
      </li>
    `).join("")

    return cards || `<li class="lobby-empty">no lobbies yet</li>`
  }

  const renderBrowser = () => {
    renderShell(`
      <div class="lobby-browser-actions">
        <button class="create-lobby-button" type="button" ${connectionStatus !== "connected" ? "disabled" : ""}>Create lobby</button>
        <button class="refresh-lobbies-button secondary-button" type="button">Refresh</button>
      </div>
      <section class="lobby-roster" aria-label="Open lobbies">
        <div class="lobby-roster-header">
          <span>available lobbies</span>
          <span>${escapeHtml(statusMessage)}</span>
        </div>
        <ul class="lobby-list">${renderLobbyCards()}</ul>
      </section>
    `)

    const createButton = state.app.querySelector<HTMLButtonElement>(".create-lobby-button")
    const refreshButton = state.app.querySelector<HTMLButtonElement>(".refresh-lobbies-button")

    if (!createButton || !refreshButton) {
      throw new Error("Lobby browser failed to render")
    }

    createButton.addEventListener("click", () => {
      state.lobbyConnection?.createLobby()
      statusMessage = "creating"
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
          statusMessage = `joining ${slug}`
          render()
        }
      })
    })
  }

  const renderRoom = () => {
    const shareUrl = `${window.location.origin}/lobby/${state.currentLobbySlug}`
    const isHost = selfId === state.currentLobbyHostId

    renderShell(`
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
          <button class="start-button" type="button" ${!isHost || lobbyPlayers.length === 0 ? "disabled" : ""}>Start</button>
          <button class="leave-lobby-button secondary-button" type="button">Leave</button>
        </div>
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
                <option value="${preset.id}" ${roomSettings.mapSize === preset.id ? "selected" : ""}>${preset.label}</option>
              `).join("")}
            </select>
          </label>
          <label>
            <span>asteroid density ${Math.round(roomSettings.asteroidDensity * 100)}%</span>
            <input name="asteroidDensity" type="range" min="${roomSettingsBounds.asteroidDensity.min}" max="${roomSettingsBounds.asteroidDensity.max}" step="${roomSettingsBounds.asteroidDensity.step}" value="${roomSettings.asteroidDensity}" ${!isHost || state.activeGame ? "disabled" : ""} />
          </label>
          <label>
            <span>player lives</span>
            <input name="playerLives" type="number" min="${roomSettingsBounds.playerLives.min}" max="${roomSettingsBounds.playerLives.max}" step="${roomSettingsBounds.playerLives.step}" value="${roomSettings.playerLives}" ${!isHost || state.activeGame ? "disabled" : ""} />
          </label>
          <label>
            <span>max ship speed</span>
            <input name="maxShipSpeed" type="number" min="${roomSettingsBounds.maxShipSpeed.min}" max="${roomSettingsBounds.maxShipSpeed.max}" step="${roomSettingsBounds.maxShipSpeed.step}" value="${roomSettings.maxShipSpeed}" ${!isHost || state.activeGame ? "disabled" : ""} />
          </label>
          <label class="settings-toggle">
            <input name="friendlyFire" type="checkbox" ${roomSettings.friendlyFire ? "checked" : ""} ${!isHost || state.activeGame ? "disabled" : ""} />
            <span>friendly fire + collisions</span>
          </label>
        </div>
      </section>
      ${renderAsteroidEditor(asteroidNames)}
    `)

    const playerList = state.app.querySelector<HTMLUListElement>(".player-list")
    const startButton = state.app.querySelector<HTMLButtonElement>(".start-button")
    const leaveButton = state.app.querySelector<HTMLButtonElement>(".leave-lobby-button")
    const shareInput = state.app.querySelector<HTMLInputElement>(".share-url")
    const copyInviteButton = state.app.querySelector<HTMLButtonElement>(".copy-invite-button")
    const roomSettingsElement = state.app.querySelector<HTMLElement>(".room-settings")
    const randomizeSettingsButton = state.app.querySelector<HTMLButtonElement>(".randomize-settings-button")
    const asteroidNameEditor = state.app.querySelector<HTMLElement>(".asteroid-name-editor")

    if (
      !playerList ||
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
      ...lobbyPlayers.map((player) => {
        const item = document.createElement("li")
        const swatch = document.createElement("span")
        const name = document.createElement("span")

        item.className = "player-list-item"
        swatch.className = "player-swatch"
        swatch.style.background = player.color
        name.textContent = `${player.username}${player.id === selfId ? " / you" : ""}${player.id === state.currentLobbyHostId ? " / host" : ""}`
        item.append(swatch, name)

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

      const form = new FormData()
      const mapSize = roomSettingsElement.querySelector<HTMLSelectElement>("select[name='mapSize']")
      const asteroidDensity = roomSettingsElement.querySelector<HTMLInputElement>("input[name='asteroidDensity']")
      const playerLives = roomSettingsElement.querySelector<HTMLInputElement>("input[name='playerLives']")
      const maxShipSpeed = roomSettingsElement.querySelector<HTMLInputElement>("input[name='maxShipSpeed']")
      const friendlyFire = roomSettingsElement.querySelector<HTMLInputElement>("input[name='friendlyFire']")

      form.set("mapSize", mapSize?.value ?? roomSettings.mapSize)
      form.set("asteroidDensity", asteroidDensity?.value ?? String(roomSettings.asteroidDensity))
      form.set("playerLives", playerLives?.value ?? String(roomSettings.playerLives))
      form.set("maxShipSpeed", maxShipSpeed?.value ?? String(roomSettings.maxShipSpeed))
      roomSettings = sanitizeRoomSettings({
        mapSize: String(form.get("mapSize")),
        asteroidDensity: Number(form.get("asteroidDensity")),
        playerLives: Number(form.get("playerLives")),
        friendlyFire: friendlyFire?.checked ?? false,
        maxShipSpeed: Number(form.get("maxShipSpeed"))
      })
      state.lobbyConnection?.setRoomSettings(roomSettings)
      render()
    }
    roomSettingsElement.addEventListener("change", sendRoomSettings)
    roomSettingsElement.querySelector<HTMLInputElement>("input[name='asteroidDensity']")?.addEventListener("input", sendRoomSettings)
    randomizeSettingsButton.addEventListener("click", () => {
      roomSettings = createRandomRoomSettings()
      state.lobbyConnection?.setRoomSettings(roomSettings)
      render()
    })
    startButton.addEventListener("click", () => {
      if (isHost) {
        state.lobbyConnection?.startGame()
      }
    })
    leaveButton.addEventListener("click", () => {
      state.lobbyConnection?.leaveLobby()
      setRoute()
      state.currentLobbySlug = ""
      state.currentLobbyHostId = ""
      view = "browser"
      state.lobbyConnection?.listLobbies()
      render()
    })
    asteroidNameEditor.addEventListener("change", () => {
      asteroidNames = parseAsteroidNameInputs(asteroidNameEditor)
      saveStoredAsteroidNames(asteroidNames)
      state.lobbyConnection?.setAsteroidNames(asteroidNames)
      render()
    })
  }

  const renderNotFound = () => {
    renderShell(`
      <section class="not-found-panel">
        <p class="signal">NO SIGNAL</p>
        <h2>Lobby not found</h2>
        <p>${escapeHtml(statusMessage)}</p>
        <button class="back-to-lobbies-button" type="button">Back to lobbies</button>
      </section>
    `)

    const button = state.app.querySelector<HTMLButtonElement>(".back-to-lobbies-button")

    button?.addEventListener("click", () => {
      pendingSlug = undefined
      setRoute()
      view = state.currentUsername ? "browser" : "username"
      state.lobbyConnection?.listLobbies()
      render()
    })
  }

  const render = () => {
    if (view === "username") {
      renderUsernameGate()
      return
    }

    if (view === "room") {
      renderRoom()
      return
    }

    if (view === "notFound") {
      renderNotFound()
      return
    }

    renderBrowser()
  }

  state.lobbyConnection = createLobbyConnection({
    onUsernameAccepted: (message) => {
      state.currentUsername = message.username
      renderPlayerHeader(state)

      if (pendingSlug) {
        state.lobbyConnection?.join(pendingSlug)
        statusMessage = `joining ${pendingSlug}`
        return
      }

      view = "browser"
      state.lobbyConnection?.listLobbies()
      render()
    },
    onUsernameRejected: () => {
      statusMessage = "username required"
      view = "username"
      render()
    },
    onLobbyList: (message) => {
      lobbies = message.lobbies
      if (view === "browser") {
        render()
      }
    },
    onLobbyCreated: (message) => {
      state.currentLobbySlug = message.lobby.slug
      state.currentLobbyHostId = message.lobby.hostId
      setRoute(message.lobby.slug)
      view = "room"
      render()
    },
    onLobbyNotFound: (message) => {
      statusMessage = `${message.slug} does not exist or already closed`
      pendingSlug = undefined
      view = "notFound"
      render()
    },
    onLobbyJoinRejected: (message) => {
      statusMessage =
        message.reason === "gameInProgress"
          ? "game already in progress"
          : "lobby does not exist or already closed"
      view = message.reason === "notFound" ? "notFound" : "browser"
      render()
    },
    onState: (message) => {
      selfId = message.selfId
      state.currentLobbySlug = message.slug
      state.currentLobbyHostId = message.hostId
      lobbyPlayers = message.players
      asteroidNames = message.asteroidNames
      roomSettings = message.settings
      state.currentUsername =
        message.players.find((player) => player.id === message.selfId)?.username ?? state.currentUsername
      pendingSlug = undefined
      setRoute(message.slug)
      view = "room"
      if (state.activeGame) {
        const previousScores = state.activeGame.scores.players

        state.activeGame.players = message.players
        state.activeGame.scores = {
          teamScore: state.activeGame.scores.teamScore,
          players: message.players
            .map((player) => ({
              ...player,
              score: previousScores.find((score) => score.id === player.id)?.score ?? 0
            }))
            .sort((left, right) => right.score - left.score || left.username.localeCompare(right.username))
        }
        state.activeGame.lives = {
          players: message.players.map((player) => ({
            ...player,
            lives: getLife(state.activeGame?.lives, player.id)?.lives ?? roomSettings.playerLives,
            isEliminated: getLife(state.activeGame?.lives, player.id)?.isEliminated ?? false
          }))
        }
        state.activeGame.settings = message.settings
        renderScorePanel(state.activeGame.scores)
      }
      renderPlayerHeader(state)
      if (!state.activeGame) {
        render()
      }
    },
    onGameStarted: (message) => {
      state.currentLobbySlug = message.slug
      state.currentLobbyHostId = message.hostId
      roomSettings = message.settings
      startGame(state, message.players, message.selfId, message.settings)
    },
    onPlayerState: (message) => {
      if (message.playerId !== state.activeGame?.selfId) {
        state.hiddenPlayerIds.delete(message.playerId)
        state.activeGame?.remoteTargets.set(message.playerId, message.ship)
      }
    },
    onPlayerDestroyed: (message) => {
      const player = state.activeGame?.players.find((nextPlayer) => nextPlayer.id === message.playerId)

      if (player) {
        state.gameAudio?.playPlayerExplosion()
        state.hiddenPlayerIds.add(message.playerId)
        state.incomingExplosions = [
          ...state.incomingExplosions,
          {
            position: message.ship.position,
            color: player.color,
            ageSeconds: 0
          }
        ]
      }
    },
    onProjectileFired: (message) => {
      if (state.activeGame && message.playerId !== state.activeGame.selfId) {
        state.gameAudio?.playFire()
        state.incomingProjectiles = [
          ...state.incomingProjectiles.filter((projectile) => projectile.id !== message.projectile.id),
          message.projectile
        ]
      }
    },
    onAsteroidState: (message) => {
      if (state.activeGame) {
        state.activeGame.asteroids = message.asteroids
      }
    },
    onAsteroidDestroyed: (message) => {
      state.gameAudio?.playAsteroidDestroyed()
      state.incomingExplosions = [
        ...state.incomingExplosions,
        {
          position: message.asteroid.position,
          color: asteroidExplosionColorBySize[message.asteroid.size],
          ageSeconds: 0
        }
      ]
    },
    onPowerUpState: (message) => {
      if (state.activeGame) {
        const previousPowerUpIds = new Set(state.activeGame.powerUps.map((powerUp) => powerUp.id))
        const hasNewPowerUp = message.powerUps.some((powerUp) => !previousPowerUpIds.has(powerUp.id))

        state.activeGame.powerUps = message.powerUps

        if (hasNewPowerUp) {
          state.gameAudio?.playPowerUpSpawn()
        }
      }
    },
    onPowerUpCollected: (message) => {
      if (state.activeGame) {
        state.activeGame.powerUps = state.activeGame.powerUps.filter((powerUp) => powerUp.id !== message.powerUp.id)
        state.incomingExplosions = [
          ...state.incomingExplosions,
          {
            position: message.powerUp.position,
            color: powerUpExplosionColorByType[message.powerUp.type],
            ageSeconds: 0
          }
        ]
        state.gameAudio?.playPowerUpCollected()
      }
    },
    onPowerUpEffectState: (message) => {
      if (state.activeGame) {
        state.activeGame.powerUpEffects = message.effects
      }
    },
    onScoreState: (message) => {
      if (state.activeGame) {
        const previousScores = state.activeGame.scores

        state.activeGame.scores = message.scores
        renderScorePanel(message.scores, previousScores)
      }
    },
    onLifeState: (message) => {
      if (state.activeGame) {
        state.activeGame.lives = message.lives
        renderPlayerHeader(state)
      }
    },
    onGameOver: (message) => {
      if (state.activeGame) {
        state.activeGame.isGameOver = true
        state.activeGame.scores = message.scores
        state.activeGame.lives = message.lives
        renderPlayerHeader(state)
        renderScorePanel(message.scores)
        renderGameOver(state, message.scores, message.asteroidStats, message.recap, () => renderLobby(state))
      }
    },
    onStatus: (nextStatus) => {
      connectionStatus = nextStatus
      if (state.currentUsername && nextStatus === "connected") {
        state.lobbyConnection?.setUsername(state.currentUsername)
      }
      render()
    }
  })

  render()
}
