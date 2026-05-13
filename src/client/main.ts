import { createProjectile } from "../game/create-projectile"
import { createStartingPlayerShip } from "../game/create-starting-player-ship"
import { updateProjectiles } from "../game/update-projectiles"
import { updatePlayer } from "../game/update-player"
import { gameConfig } from "../shared/game-config"
import type { Asteroid, PlayerShip, Projectile } from "../shared/game-types"
import type { LobbyPlayer, NetworkPlayerShip } from "../shared/lobby-types"
import { createKeyboardInput } from "./input/create-keyboard-input"
import { createLobbyConnection } from "./lobby/create-lobby-connection"
import { renderGame } from "./render/render-game"
import "./styles.css"

const world = {
  width: gameConfig.mapTilesWide * gameConfig.tileSize,
  height: gameConfig.mapTilesTall * gameConfig.tileSize
}

const app = document.querySelector<HTMLDivElement>("#app")

if (!app) {
  throw new Error("Missing #app")
}

let animationFrame = 0
let keyboard: ReturnType<typeof createKeyboardInput> | undefined
let lobbyConnection: ReturnType<typeof createLobbyConnection> | undefined
let currentUsername = ""
let activeGame:
  | {
      selfId: string
      players: LobbyPlayer[]
      remoteTargets: Map<string, NetworkPlayerShip>
      asteroids: Asteroid[]
    }
  | undefined

const resizeCanvas = (canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) => {
  const pixelRatio = window.devicePixelRatio || 1
  const width = window.innerWidth
  const height = window.innerHeight

  canvas.width = Math.floor(width * pixelRatio)
  canvas.height = Math.floor(height * pixelRatio)
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
}

const smoothNumber = (current: number, target: number, deltaSeconds: number) => {
  const amount = 1 - Math.exp(-gameConfig.remotePlayerSmoothingPerSecond * deltaSeconds)

  return current + (target - current) * amount
}

const smoothShip = (current: PlayerShip, target: NetworkPlayerShip, deltaSeconds: number): PlayerShip => ({
  position: {
    x: smoothNumber(current.position.x, target.position.x, deltaSeconds),
    y: smoothNumber(current.position.y, target.position.y, deltaSeconds)
  },
  velocity: {
    x: smoothNumber(current.velocity.x, target.velocity.x, deltaSeconds),
    y: smoothNumber(current.velocity.y, target.velocity.y, deltaSeconds)
  },
  angle: smoothNumber(current.angle, target.angle, deltaSeconds)
})

const renderPlayerHeader = () => {
  document.querySelector(".player-header")?.remove()

  if (currentUsername.length === 0) {
    return
  }

  const header = document.createElement("header")
  const label = document.createElement("span")
  const name = document.createElement("strong")
  const editButton = document.createElement("button")
  const form = document.createElement("form")
  const input = document.createElement("input")
  const saveButton = document.createElement("button")

  header.className = "player-header"
  label.textContent = "pilot"
  name.textContent = currentUsername
  editButton.type = "button"
  editButton.textContent = "Change"
  form.className = "rename-form"
  form.hidden = true
  input.value = currentUsername
  input.maxLength = 18
  saveButton.type = "submit"
  saveButton.textContent = "Save"
  saveButton.disabled = input.value.trim().length === 0
  form.append(input, saveButton)
  header.append(label, name, editButton, form)
  app.append(header)

  editButton.addEventListener("click", () => {
    form.hidden = false
    editButton.hidden = true
    input.value = currentUsername
    input.focus()
    input.select()
  })

  input.addEventListener("input", () => {
    saveButton.disabled = input.value.trim().length === 0
  })

  form.addEventListener("submit", (event) => {
    event.preventDefault()

    const nextUsername = input.value.trim()

    if (nextUsername.length === 0) {
      input.value = currentUsername
      saveButton.disabled = false
      return
    }

    currentUsername = nextUsername
    lobbyConnection?.join(nextUsername)
    renderPlayerHeader()
  })
}

const startGame = (players: LobbyPlayer[], selfId: string) => {
  cancelAnimationFrame(animationFrame)
  keyboard?.destroy()

  activeGame = {
    selfId,
    players,
    remoteTargets: new Map(),
    asteroids: []
  }
  currentUsername = players.find((player) => player.id === selfId)?.username ?? currentUsername

  app.innerHTML = `<canvas class="game-canvas" aria-label="Stroid game map"></canvas>`
  renderPlayerHeader()

  const canvas = app.querySelector<HTMLCanvasElement>("canvas")
  const context = canvas?.getContext("2d")

  if (!canvas || !context) {
    throw new Error("Canvas failed to start")
  }

  const self = players.find((player) => player.id === selfId)

  if (!self) {
    throw new Error("Cannot start game without local player")
  }

  const shipsByPlayerId = new Map<string, PlayerShip>()
  const syncShips = (nextPlayers: LobbyPlayer[]) => {
    nextPlayers.forEach((lobbyPlayer, index) => {
      if (!shipsByPlayerId.has(lobbyPlayer.id)) {
        shipsByPlayerId.set(lobbyPlayer.id, createStartingPlayerShip(index, nextPlayers.length))
      }
    })
  }
  let projectiles: Projectile[] = []
  let lastFireTime = -Infinity
  let projectileId = 0
  let lastTime = performance.now()
  let lastPlayerStateSent = 0
  keyboard = createKeyboardInput(window)
  syncShips(players)

  const onResize = () => resizeCanvas(canvas, context)
  window.addEventListener("resize", onResize)
  onResize()

  const tick = (now: number) => {
    const deltaSeconds = Math.min(0.05, (now - lastTime) / 1000)
    lastTime = now
    const input = keyboard?.read() ?? {
      thrust: false,
      turnLeft: false,
      turnRight: false,
      fire: false
    }

    const localShip = shipsByPlayerId.get(selfId)

    if (!localShip) {
      throw new Error("Local ship is missing")
    }

    const updatedLocalShip = updatePlayer(localShip, input, deltaSeconds, world)
    shipsByPlayerId.set(selfId, updatedLocalShip)
    projectiles = updateProjectiles(projectiles, deltaSeconds, world)

    const gamePlayers = activeGame?.players ?? players
    const selfPlayer = gamePlayers.find((lobbyPlayer) => lobbyPlayer.id === selfId) ?? self
    const asteroids = activeGame?.asteroids ?? []
    syncShips(gamePlayers)

    activeGame?.remoteTargets.forEach((ship, playerId) => {
      const currentShip = shipsByPlayerId.get(playerId)

      if (currentShip && playerId !== selfId) {
        shipsByPlayerId.set(playerId, smoothShip(currentShip, ship, deltaSeconds))
      }
    })

    if (now - lastPlayerStateSent >= gameConfig.playerStateSendIntervalMs) {
      lastPlayerStateSent = now
      lobbyConnection?.sendPlayerState({
        position: updatedLocalShip.position,
        velocity: updatedLocalShip.velocity,
        angle: updatedLocalShip.angle,
        isThrusting: input.thrust
      })
    }

    if (input.fire && now / 1000 - lastFireTime >= gameConfig.fireCooldownSeconds) {
      lastFireTime = now / 1000
      projectileId += 1
      projectiles = [
        ...projectiles,
        createProjectile(
          `${selfPlayer.username}-${projectileId}`,
          selfPlayer.username,
          selfPlayer.color,
          updatedLocalShip
        )
      ]
    }

    const hitProjectileIds = new Set<string>()
    asteroids.forEach((asteroid) => {
      const projectile = projectiles.find(
        (nextProjectile) =>
          !hitProjectileIds.has(nextProjectile.id) &&
          Math.hypot(nextProjectile.position.x - asteroid.position.x, nextProjectile.position.y - asteroid.position.y) <=
            asteroid.radius + gameConfig.projectileRadius
      )

      if (projectile) {
        hitProjectileIds.add(projectile.id)
        lobbyConnection?.sendAsteroidHit(asteroid.id)
      }
    })
    projectiles = projectiles.filter((projectile) => !hitProjectileIds.has(projectile.id))

    const localPlayer = {
      username: selfPlayer.username,
      ship: updatedLocalShip,
      color: selfPlayer.color,
      isThrusting: input.thrust
    }
    const renderPlayers = gamePlayers.map((lobbyPlayer) => ({
      username: lobbyPlayer.username,
      ship: shipsByPlayerId.get(lobbyPlayer.id) ?? updatedLocalShip,
      color: lobbyPlayer.color,
      isThrusting:
        lobbyPlayer.id === selfId
          ? input.thrust
          : activeGame?.remoteTargets.get(lobbyPlayer.id)?.isThrusting ?? false
    }))

    renderGame({
      context,
      viewport: {
        x: window.innerWidth,
        y: window.innerHeight
      },
      world,
      localPlayer,
      players: renderPlayers,
      projectiles,
      asteroids,
      timeSeconds: now / 1000
    })

    animationFrame = requestAnimationFrame(tick)
  }

  animationFrame = requestAnimationFrame(tick)
}

const renderLobby = () => {
  let lobbyPlayers: LobbyPlayer[] = []
  let connectionStatus = "connecting"
  let selfId = ""
  activeGame = undefined

  app.innerHTML = `
    <main class="lobby-shell">
      <section class="lobby-panel">
        <p class="signal">STROID / LOCAL FLIGHT TEST</p>
        <h1>Stroid</h1>
        <form class="join-form">
          <label>
            <span>username</span>
            <input name="username" autocomplete="nickname" maxlength="18" />
          </label>
          <button class="join-button" type="submit" disabled>Join lobby</button>
        </form>
        <section class="lobby-roster" aria-label="Lobby players">
          <div class="lobby-roster-header">
            <span>players</span>
            <span class="connection-status">connecting</span>
          </div>
          <ul class="player-list"></ul>
          <button class="start-button" type="button" disabled>Start</button>
        </section>
      </section>
    </main>
  `

  const form = app.querySelector<HTMLFormElement>(".join-form")
  const input = app.querySelector<HTMLInputElement>("input[name='username']")
  const joinButton = app.querySelector<HTMLButtonElement>(".join-button")
  const startButton = app.querySelector<HTMLButtonElement>(".start-button")
  const playerList = app.querySelector<HTMLUListElement>(".player-list")
  const status = app.querySelector<HTMLSpanElement>(".connection-status")

  if (!form || !input || !joinButton || !startButton || !playerList || !status) {
    throw new Error("Lobby failed to render")
  }
  renderPlayerHeader()

  const updateLobby = () => {
    status.textContent = connectionStatus
    playerList.replaceChildren(
      ...lobbyPlayers.map((player) => {
        const item = document.createElement("li")
        const swatch = document.createElement("span")
        const name = document.createElement("span")

        item.className = "player-list-item"
        swatch.className = "player-swatch"
        swatch.style.background = player.color
        name.textContent = `${player.username}${player.id === selfId ? " / you" : ""}`
        item.append(swatch, name)

        return item
      })
    )
    startButton.disabled = currentUsername.length === 0
    joinButton.disabled =
      input.value.trim().length === 0 || connectionStatus !== "connected" || currentUsername.length > 0
  }

  input.focus()

  input.addEventListener("input", () => {
    updateLobby()
  })

  form.addEventListener("submit", (event) => {
    event.preventDefault()

    const username = input.value.trim()

    if (!username || connectionStatus !== "connected") {
      return
    }

    currentUsername = username
    input.disabled = true
    joinButton.disabled = true
    lobbyConnection?.join(username)
    renderPlayerHeader()
    updateLobby()
  })

  startButton.addEventListener("click", () => {
    if (currentUsername.length > 0) {
      lobbyConnection?.startGame()
    }
  })

  lobbyConnection?.destroy()
  lobbyConnection = createLobbyConnection({
    onState: (message) => {
      selfId = message.selfId
      lobbyPlayers = message.players
      currentUsername =
        message.players.find((player) => player.id === message.selfId)?.username ?? currentUsername
      if (activeGame) {
        activeGame.players = message.players
      }
      renderPlayerHeader()
      updateLobby()
    },
    onGameStarted: (message) => {
      startGame(message.players, message.selfId)
    },
    onPlayerState: (message) => {
      if (message.playerId !== activeGame?.selfId) {
        activeGame?.remoteTargets.set(message.playerId, message.ship)
      }
    },
    onAsteroidState: (message) => {
      if (activeGame) {
        activeGame.asteroids = message.asteroids
      }
    },
    onStatus: (nextStatus) => {
      connectionStatus = nextStatus
      updateLobby()
    }
  })

  updateLobby()
}

renderLobby()
