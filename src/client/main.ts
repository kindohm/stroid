import { createProjectile } from "../game/create-projectile"
import { createStartingPlayerShip } from "../game/create-starting-player-ship"
import { updateProjectiles } from "../game/update-projectiles"
import { updatePlayer } from "../game/update-player"
import { gameConfig } from "../shared/game-config"
import type { Asteroid, PlayerShip, Projectile } from "../shared/game-types"
import type {
  AsteroidStatsState,
  AsteroidNamePools,
  AsteroidNameSize,
  LifeState,
  LobbyPlayer,
  NetworkPlayerShip,
  ScoreState
} from "../shared/lobby-types"
import { createKeyboardInput } from "./input/create-keyboard-input"
import { createLobbyConnection } from "./lobby/create-lobby-connection"
import { renderGame, type RenderExplosion } from "./render/render-game"
import "./styles.css"

const world = {
  width: gameConfig.mapTilesWide * gameConfig.tileSize,
  height: gameConfig.mapTilesTall * gameConfig.tileSize
}
const defaultAsteroidNames: AsteroidNamePools = {
  extraLarge: ["Worldbone", "Old Mountain", "The Big Oof"],
  large: ["Goliath", "Big Drift", "Hullbreaker"],
  medium: ["Nomad", "Basalt", "Cinder"],
  small: ["Pebble", "Spark", "Chip"]
}
const asteroidNameSizes: AsteroidNameSize[] = ["extraLarge", "large", "medium", "small"]
const asteroidNameLabels: Record<AsteroidNameSize, string> = {
  extraLarge: "extra large",
  large: "large",
  medium: "medium",
  small: "small"
}
const asteroidNameStorageKey = "stroid.asteroidNames"

const app = document.querySelector<HTMLDivElement>("#app")

if (!app) {
  throw new Error("Missing #app")
}

let animationFrame = 0
let keyboard: ReturnType<typeof createKeyboardInput> | undefined
let lobbyConnection: ReturnType<typeof createLobbyConnection> | undefined
let currentUsername = ""
let incomingProjectiles: Projectile[] = []
let activeGame:
  | {
      selfId: string
      players: LobbyPlayer[]
      remoteTargets: Map<string, NetworkPlayerShip>
      asteroids: Asteroid[]
      scores: ScoreState
      lives: LifeState
      isGameOver: boolean
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

const lerp = (from: number, to: number, amount: number) => from + (to - from) * amount

const interpolateShip = (from: PlayerShip, to: PlayerShip, amount: number): PlayerShip => ({
  position: {
    x: lerp(from.position.x, to.position.x, amount),
    y: lerp(from.position.y, to.position.y, amount)
  },
  velocity: {
    x: lerp(from.velocity.x, to.velocity.x, amount),
    y: lerp(from.velocity.y, to.velocity.y, amount)
  },
  angle: lerp(from.angle, to.angle, amount)
})

const renderPlayerHeader = () => {
  document.querySelector(".player-header")?.remove()

  if (currentUsername.length === 0) {
    return
  }

  const header = document.createElement("header")
  const label = document.createElement("span")
  const name = document.createElement("strong")
  const lives = document.createElement("span")
  const editButton = document.createElement("button")
  const form = document.createElement("form")
  const input = document.createElement("input")
  const saveButton = document.createElement("button")
  const localLife = activeGame ? getLife(activeGame.lives, activeGame.selfId) : undefined
  const localPlayer = activeGame?.players.find((player) => player.id === activeGame?.selfId)
  const shipsLeft = localLife?.lives ?? 0

  header.className = "player-header"
  label.textContent = "pilot"
  name.textContent = currentUsername
  lives.className = "ship-lives"
  lives.setAttribute("aria-label", `${shipsLeft} ships left`)
  lives.hidden = !activeGame
  for (let index = 0; index < shipsLeft; index += 1) {
    const ship = document.createElement("span")

    ship.className = "ship-life-icon"
    ship.style.background = localPlayer?.color ?? "#74ffe0"
    ship.style.color = localPlayer?.color ?? "#74ffe0"
    lives.append(ship)
  }
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
  header.append(label, name, lives, editButton, form)
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

const createEmptyScoreState = (players: LobbyPlayer[]): ScoreState => {
  const scoredPlayers = players
    .map((player) => ({
      ...player,
      score: 0
    }))
    .sort((left, right) => left.username.localeCompare(right.username))

  return {
    teamScore: 0,
    players: scoredPlayers
  }
}

const createInitialLifeState = (players: LobbyPlayer[]): LifeState => ({
  players: players.map((player) => ({
    ...player,
    lives: gameConfig.playerStartingLives,
    isEliminated: false
  }))
})

const getLife = (lives: LifeState | undefined, playerId: string) =>
  lives?.players.find((player) => player.id === playerId)

const isPlayerEliminated = (lives: LifeState | undefined, playerId: string) =>
  getLife(lives, playerId)?.isEliminated ?? false

const formatAsteroidNameList = (names: string[]) => names.join("\n")

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")

const parseAsteroidNameList = (value: string) =>
  value
    .split(/[\n,]/)
    .map((name) => name.trim())
    .filter((name) => name.length > 0)

const parseAsteroidNameInputs = (container: ParentNode): AsteroidNamePools =>
  asteroidNameSizes.reduce((pools, size) => {
    const input = container.querySelector<HTMLTextAreaElement>(`textarea[data-asteroid-size="${size}"]`)
    const names = input ? parseAsteroidNameList(input.value) : []

    return {
      ...pools,
      [size]: names.length > 0 ? names : defaultAsteroidNames[size]
    }
  }, {} as AsteroidNamePools)

const sanitizeAsteroidNamePools = (value: unknown): AsteroidNamePools | undefined => {
  if (!value || typeof value !== "object") {
    return undefined
  }

  const source = value as Partial<Record<AsteroidNameSize, unknown>>

  return asteroidNameSizes.reduce((pools, size) => {
    const names = Array.isArray(source[size])
      ? source[size]
          .filter((name): name is string => typeof name === "string")
          .map((name) => name.trim())
          .filter((name) => name.length > 0)
      : []

    return {
      ...pools,
      [size]: names.length > 0 ? names : defaultAsteroidNames[size]
    }
  }, {} as AsteroidNamePools)
}

const loadStoredAsteroidNames = (): AsteroidNamePools | undefined => {
  try {
    const stored = localStorage.getItem(asteroidNameStorageKey)

    if (!stored) {
      return undefined
    }

    return sanitizeAsteroidNamePools(JSON.parse(stored))
  } catch {
    return undefined
  }
}

const saveStoredAsteroidNames = (asteroidNames: AsteroidNamePools) => {
  try {
    localStorage.setItem(asteroidNameStorageKey, JSON.stringify(asteroidNames))
  } catch {
    // Local storage is best-effort; the live lobby should keep working without it.
  }
}

const renderScorePanel = (scores: ScoreState, previousScores?: ScoreState) => {
  const panel = document.querySelector<HTMLElement>(".score-panel")

  if (!panel) {
    return
  }

  const totalLabel = document.createElement("span")
  const totalValue = document.createElement("strong")
  const totalRow = document.createElement("div")
  const heading = document.createElement("h2")
  const list = document.createElement("ol")
  const popLayer = document.createElement("div")

  totalLabel.textContent = "team"
  totalValue.textContent = scores.teamScore.toLocaleString()
  totalRow.className = "score-total"
  totalRow.append(totalLabel, totalValue)
  heading.textContent = "pilot scores"
  list.className = "score-list"
  popLayer.className = "score-pop-layer"

  scores.players.forEach((player, index) => {
    const item = document.createElement("li")
    const swatch = document.createElement("span")
    const name = document.createElement("span")
    const value = document.createElement("strong")
    const previousScore = previousScores?.players.find((score) => score.id === player.id)?.score
    const scoreDelta = previousScore === undefined ? 0 : player.score - previousScore

    item.className = "score-list-item"
    swatch.className = "score-swatch"
    swatch.style.background = player.color
    swatch.style.color = player.color
    name.textContent = player.username
    value.textContent = player.score.toLocaleString()
    item.append(swatch, name, value)
    list.append(item)

    if (scoreDelta > 0) {
      const pop = document.createElement("span")

      pop.className = "score-pop"
      pop.textContent = `+${scoreDelta.toLocaleString()}`
      pop.style.color = player.color
      pop.style.top = `${74 + index * 31}px`
      popLayer.append(pop)
    }
  })

  if (scores.players.length === 0) {
    const empty = document.createElement("li")

    empty.className = "score-empty"
    empty.textContent = "no scores yet"
    list.append(empty)
  }

  panel.replaceChildren(totalRow, heading, list, popLayer)
}

const renderGameOver = (scores: ScoreState, asteroidStats?: AsteroidStatsState) => {
  document.querySelector(".game-over-panel")?.remove()

  const overlay = document.createElement("section")
  const panel = document.createElement("div")
  const eyebrow = document.createElement("p")
  const title = document.createElement("h1")
  const total = document.createElement("strong")
  const list = document.createElement("ol")
  const asteroidLeaders = document.createElement("section")
  const backButton = document.createElement("button")

  overlay.className = "game-over-panel"
  panel.className = "game-over-card"
  eyebrow.className = "signal"
  eyebrow.textContent = "all ships lost"
  title.textContent = "Game over"
  total.className = "game-over-total"
  total.textContent = `Team score ${scores.teamScore.toLocaleString()}`
  list.className = "game-over-list"
  asteroidLeaders.className = "game-over-asteroid-leaders"

  scores.players.forEach((player) => {
    const item = document.createElement("li")
    const swatch = document.createElement("span")
    const name = document.createElement("span")
    const value = document.createElement("strong")

    swatch.className = "score-swatch"
    swatch.style.background = player.color
    swatch.style.color = player.color
    name.textContent = player.username
    value.textContent = player.score.toLocaleString()
    item.append(swatch, name, value)
    list.append(item)
  })

  if (asteroidStats) {
    const heading = document.createElement("h2")
    const table = document.createElement("table")
    const tableHead = document.createElement("thead")
    const tableBody = document.createElement("tbody")
    const headerRow = document.createElement("tr")
    const rows = asteroidNameSizes
      .flatMap((size) => {
        const asteroidNames = new Set<string>()

        asteroidStats.players.forEach((player) => {
          Object.keys(player.destroyedNamesBySize[size]).forEach((name) => asteroidNames.add(name))
        })

        return [...asteroidNames].map((asteroidName) => {
          const leader = asteroidStats.players
            .map((player) => ({
              ...player,
              killCount: player.destroyedNamesBySize[size][asteroidName] ?? 0
            }))
            .sort((left, right) => right.killCount - left.killCount || left.username.localeCompare(right.username))[0]

          return {
            asteroidName,
            leader,
            size
          }
        })
      })
      .filter((row) => row.leader.killCount > 0)
      .sort((left, right) => left.size.localeCompare(right.size) || left.asteroidName.localeCompare(right.asteroidName))

    heading.textContent = "Asteroid name leaders"
    table.className = "game-over-asteroid-table"
    ;["Asteroid", "Pilot", "Kills"].forEach((label) => {
      const cell = document.createElement("th")

      cell.textContent = label
      headerRow.append(cell)
    })
    tableHead.append(headerRow)

    rows.forEach((leaderRow) => {
      const row = document.createElement("tr")
      const asteroidName = document.createElement("td")
      const pilot = document.createElement("td")
      const kills = document.createElement("td")

      asteroidName.textContent = leaderRow.asteroidName
      pilot.textContent = leaderRow.leader.username
      pilot.style.color = leaderRow.leader.color
      kills.textContent = leaderRow.leader.killCount.toLocaleString()
      row.append(asteroidName, pilot, kills)
      tableBody.append(row)
    })

    if (rows.length === 0) {
      const row = document.createElement("tr")
      const empty = document.createElement("td")

      empty.colSpan = 3
      empty.textContent = "no named hits"
      row.append(empty)
      tableBody.append(row)
    }

    table.append(tableHead, tableBody)
    asteroidLeaders.append(heading, table)
  }

  backButton.type = "button"
  backButton.textContent = "Back to lobby"
  backButton.addEventListener("click", () => {
    renderLobby()
  })

  panel.append(eyebrow, title, total, list, asteroidLeaders, backButton)
  overlay.append(panel)
  app.append(overlay)
}

const startGame = (players: LobbyPlayer[], selfId: string) => {
  cancelAnimationFrame(animationFrame)
  keyboard?.destroy()

  activeGame = {
    selfId,
    players,
    remoteTargets: new Map(),
    asteroids: [],
    scores: createEmptyScoreState(players),
    lives: createInitialLifeState(players),
    isGameOver: false
  }
  currentUsername = players.find((player) => player.id === selfId)?.username ?? currentUsername

  app.innerHTML = `
    <canvas class="game-canvas" aria-label="Stroid game map"></canvas>
    <aside class="score-panel" aria-label="Scores"></aside>
    <aside class="control-key" aria-label="Keyboard controls">
      <div class="control-key-title">flight keys</div>
      <dl>
        <div>
          <dt><kbd>↑</kbd></dt>
          <dd>thrust</dd>
        </div>
        <div>
          <dt><kbd>←</kbd><kbd>→</kbd></dt>
          <dd>turn</dd>
        </div>
        <div>
          <dt><kbd>Space</kbd></dt>
          <dd>fire</dd>
        </div>
      </dl>
    </aside>
  `
  renderPlayerHeader()
  renderScorePanel(activeGame.scores)

  const canvas = app.querySelector<HTMLCanvasElement>("canvas")
  const context = canvas?.getContext("2d", {
    alpha: false,
    desynchronized: true
  })

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
  const localProjectileIds = new Set<string>()
  incomingProjectiles = []
  let lastFireTime = -Infinity
  let projectileId = 0
  let lastTime = performance.now()
  let localSimulationAccumulator = 0
  const localSimulationStepSeconds = 1 / 120
  let lastPlayerStateSent = 0
  keyboard = createKeyboardInput(window)
  syncShips(players)
  const initialLocalShip = shipsByPlayerId.get(selfId)

  if (!initialLocalShip) {
    throw new Error("Local ship failed to initialize")
  }

  let previousLocalShip: PlayerShip = initialLocalShip
  let localShipStatus: "alive" | "destroyed" | "eliminated" = "alive"
  let localLives: number = gameConfig.playerStartingLives
  let respawnAt = 0
  let invincibleUntil = performance.now() + gameConfig.playerSpawnInvincibilitySeconds * 1000
  let followedPlayerId: string | undefined
  let explosions: RenderExplosion[] = []

  const onResize = () => resizeCanvas(canvas, context)
  window.addEventListener("resize", onResize)
  onResize()

  const createRespawnShip = () => {
    const gamePlayers = activeGame?.players ?? players
    const selfIndex = Math.max(0, gamePlayers.findIndex((player) => player.id === selfId))

    return createStartingPlayerShip(selfIndex, gamePlayers.length)
  }

  const chooseFollowedPlayerId = (gamePlayers: LobbyPlayer[]) => {
    if (
      followedPlayerId &&
      gamePlayers.some((player) => player.id === followedPlayerId && !isPlayerEliminated(activeGame?.lives, player.id))
    ) {
      return followedPlayerId
    }

    return gamePlayers.find((player) => player.id !== selfId && !isPlayerEliminated(activeGame?.lives, player.id))?.id
  }

  const destroyLocalShip = (ship: PlayerShip, now: number) => {
    if (localShipStatus !== "alive" || now < invincibleUntil || activeGame?.isGameOver) {
      return
    }

    localLives = Math.max(0, localLives - 1)
    explosions = [
      ...explosions,
      {
        position: ship.position,
        color: self.color,
        ageSeconds: 0
      }
    ]
    lobbyConnection?.sendPlayerHit()

    if (localLives <= 0) {
      localShipStatus = "eliminated"
      followedPlayerId = chooseFollowedPlayerId(activeGame?.players ?? players)
      return
    }

    localShipStatus = "destroyed"
    respawnAt = now + gameConfig.playerRespawnDelaySeconds * 1000
  }

  const tick = (now: number) => {
    const deltaSeconds = Math.min(0.05, (now - lastTime) / 1000)
    lastTime = now
    const input = keyboard?.read() ?? {
      thrust: false,
      turnLeft: false,
      turnRight: false,
      fire: false
    }
    explosions = explosions
      .map((explosion) => ({
        ...explosion,
        ageSeconds: explosion.ageSeconds + deltaSeconds
      }))
      .filter((explosion) => explosion.ageSeconds < 0.85)

    const localShip = shipsByPlayerId.get(selfId)

    if (!localShip) {
      throw new Error("Local ship is missing")
    }

    const serverLife = getLife(activeGame?.lives, selfId)

    if (serverLife) {
      localLives = serverLife.lives

      if (serverLife.isEliminated) {
        localShipStatus = "eliminated"
      }
    }

    if (localShipStatus === "destroyed" && now >= respawnAt) {
      const respawnShip = createRespawnShip()

      previousLocalShip = respawnShip
      localShipStatus = "alive"
      invincibleUntil = now + gameConfig.playerSpawnInvincibilitySeconds * 1000
      localSimulationAccumulator = 0
      shipsByPlayerId.set(selfId, respawnShip)
    }

    let updatedLocalShip = shipsByPlayerId.get(selfId) ?? localShip
    const canControlLocalShip = localShipStatus === "alive" && !activeGame?.isGameOver

    if (canControlLocalShip) {
      localSimulationAccumulator = Math.min(
        localSimulationAccumulator + deltaSeconds,
        localSimulationStepSeconds * 5
      )

      while (localSimulationAccumulator >= localSimulationStepSeconds) {
        previousLocalShip = updatedLocalShip
        updatedLocalShip = updatePlayer(updatedLocalShip, input, localSimulationStepSeconds, world)
        localSimulationAccumulator -= localSimulationStepSeconds
      }
    }

    shipsByPlayerId.set(selfId, updatedLocalShip)
    projectiles = updateProjectiles(projectiles, deltaSeconds, world)

    if (incomingProjectiles.length > 0) {
      const nextProjectiles = incomingProjectiles

      incomingProjectiles = []
      projectiles = [
        ...projectiles.filter(
          (projectile) => !nextProjectiles.some((nextProjectile) => nextProjectile.id === projectile.id)
        ),
        ...nextProjectiles
      ]
    }

    const liveProjectileIds = new Set(projectiles.map((projectile) => projectile.id))

    localProjectileIds.forEach((projectileId) => {
      if (!liveProjectileIds.has(projectileId)) {
        localProjectileIds.delete(projectileId)
      }
    })

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

    if (canControlLocalShip && now - lastPlayerStateSent >= gameConfig.playerStateSendIntervalMs) {
      lastPlayerStateSent = now
      lobbyConnection?.sendPlayerState({
        position: updatedLocalShip.position,
        velocity: updatedLocalShip.velocity,
        angle: updatedLocalShip.angle,
        isThrusting: input.thrust
      })
    }

    if (canControlLocalShip && input.fire && now / 1000 - lastFireTime >= gameConfig.fireCooldownSeconds) {
      lastFireTime = now / 1000
      projectileId += 1
      const projectile = createProjectile(
        `${selfPlayer.username}-${projectileId}`,
        selfPlayer.username,
        selfPlayer.color,
        updatedLocalShip
      )

      localProjectileIds.add(projectile.id)
      projectiles = [
        ...projectiles,
        projectile
      ]
      lobbyConnection?.sendProjectileFired(projectile)
    }

    const localRenderShip = interpolateShip(
      previousLocalShip,
      updatedLocalShip,
      localSimulationAccumulator / localSimulationStepSeconds
    )

    const hitProjectileIds = new Set<string>()
    asteroids.forEach((asteroid) => {
      const projectile = projectiles.find(
        (nextProjectile) =>
          localProjectileIds.has(nextProjectile.id) &&
          !hitProjectileIds.has(nextProjectile.id) &&
          Math.hypot(nextProjectile.position.x - asteroid.position.x, nextProjectile.position.y - asteroid.position.y) <=
            asteroid.radius + gameConfig.projectileRadius
      )

      if (projectile) {
        hitProjectileIds.add(projectile.id)
        localProjectileIds.delete(projectile.id)
        lobbyConnection?.sendAsteroidHit(asteroid.id)
      }
    })
    projectiles = projectiles.filter((projectile) => !hitProjectileIds.has(projectile.id))

    if (canControlLocalShip && now >= invincibleUntil) {
      const hitAsteroid = asteroids.find(
        (asteroid) =>
          Math.hypot(
            updatedLocalShip.position.x - asteroid.position.x,
            updatedLocalShip.position.y - asteroid.position.y
          ) <= asteroid.radius + gameConfig.shipRadius
      )

      if (hitAsteroid) {
        destroyLocalShip(updatedLocalShip, now)
      }
    }

    if (localShipStatus === "eliminated") {
      followedPlayerId = chooseFollowedPlayerId(gamePlayers)
    }

    const renderPlayers = gamePlayers
      .filter((lobbyPlayer) => !isPlayerEliminated(activeGame?.lives, lobbyPlayer.id))
      .filter((lobbyPlayer) => lobbyPlayer.id !== selfId || localShipStatus === "alive")
      .map((lobbyPlayer) => ({
        username: lobbyPlayer.username,
        ship: lobbyPlayer.id === selfId
          ? localRenderShip
          : shipsByPlayerId.get(lobbyPlayer.id) ?? updatedLocalShip,
        color: lobbyPlayer.color,
        isThrusting:
          lobbyPlayer.id === selfId
            ? input.thrust
            : activeGame?.remoteTargets.get(lobbyPlayer.id)?.isThrusting ?? false,
        isLocal: lobbyPlayer.id === selfId,
        isInvincible: lobbyPlayer.id === selfId && localShipStatus === "alive" && now < invincibleUntil
      }))
    const followedPlayer = gamePlayers.find((player) => player.id === followedPlayerId)
    const followedShip = followedPlayer ? shipsByPlayerId.get(followedPlayer.id) : undefined
    const localPlayer = localShipStatus === "eliminated" && followedPlayer && followedShip
      ? {
          username: `watching ${followedPlayer.username}`,
          ship: followedShip,
          color: followedPlayer.color,
          isThrusting: false,
          isLocal: true,
          isInvincible: false,
          isHidden: false
        }
      : {
          username: selfPlayer.username,
          ship: localRenderShip,
          color: selfPlayer.color,
          isThrusting: canControlLocalShip && input.thrust,
          isLocal: true,
          isInvincible: localShipStatus === "alive" && now < invincibleUntil,
          isHidden: localShipStatus !== "alive"
        }

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
      explosions,
      timeSeconds: now / 1000
    })

    animationFrame = requestAnimationFrame(tick)
  }

  animationFrame = requestAnimationFrame(tick)
}

const renderLobby = () => {
  cancelAnimationFrame(animationFrame)
  keyboard?.destroy()
  let lobbyPlayers: LobbyPlayer[] = []
  const storedAsteroidNames = loadStoredAsteroidNames()
  let asteroidNames: AsteroidNamePools = storedAsteroidNames ?? defaultAsteroidNames
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
        <section class="asteroid-name-editor" aria-label="Asteroid names">
          <div class="lobby-roster-header">
            <span>asteroid callsigns</span>
            <span>comma or newline</span>
          </div>
          ${asteroidNameSizes.map((size) => `
            <label>
              <span>${asteroidNameLabels[size]}</span>
              <textarea data-asteroid-size="${size}" rows="2">${escapeHtml(formatAsteroidNameList(asteroidNames[size]))}</textarea>
            </label>
          `).join("")}
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
  const asteroidNameEditor = app.querySelector<HTMLElement>(".asteroid-name-editor")

  if (!form || !input || !joinButton || !startButton || !playerList || !status || !asteroidNameEditor) {
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
    asteroidNameSizes.forEach((size) => {
      const nameInput = asteroidNameEditor.querySelector<HTMLTextAreaElement>(`textarea[data-asteroid-size="${size}"]`)

      if (nameInput && document.activeElement !== nameInput) {
        nameInput.value = formatAsteroidNameList(asteroidNames[size])
      }
    })
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
    saveStoredAsteroidNames(asteroidNames)
    lobbyConnection?.join(username, asteroidNames)
    renderPlayerHeader()
    updateLobby()
  })

  startButton.addEventListener("click", () => {
    if (currentUsername.length > 0) {
      lobbyConnection?.startGame()
    }
  })

  asteroidNameEditor.addEventListener("change", () => {
    asteroidNames = parseAsteroidNameInputs(asteroidNameEditor)
    saveStoredAsteroidNames(asteroidNames)
    if (currentUsername.length > 0) {
      lobbyConnection?.setAsteroidNames(asteroidNames)
    }
    updateLobby()
  })

  lobbyConnection?.destroy()
  lobbyConnection = createLobbyConnection({
    onState: (message) => {
      selfId = message.selfId
      lobbyPlayers = message.players
      if (currentUsername.length > 0 || message.players.length > 0 || !storedAsteroidNames) {
        asteroidNames = message.asteroidNames
      }
      currentUsername =
        message.players.find((player) => player.id === message.selfId)?.username ?? currentUsername
      if (activeGame) {
        const previousScores = activeGame.scores.players

        activeGame.players = message.players
        activeGame.scores = {
          teamScore: activeGame.scores.teamScore,
          players: message.players
            .map((player) => ({
              ...player,
              score: previousScores.find((score) => score.id === player.id)?.score ?? 0
            }))
            .sort((left, right) => right.score - left.score || left.username.localeCompare(right.username))
        }
        activeGame.lives = {
          players: message.players.map((player) => ({
            ...player,
            lives: getLife(activeGame?.lives, player.id)?.lives ?? gameConfig.playerStartingLives,
            isEliminated: getLife(activeGame?.lives, player.id)?.isEliminated ?? false
          }))
        }
        renderScorePanel(activeGame.scores)
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
    onProjectileFired: (message) => {
      if (activeGame && message.playerId !== activeGame.selfId) {
        incomingProjectiles = [
          ...incomingProjectiles.filter((projectile) => projectile.id !== message.projectile.id),
          message.projectile
        ]
      }
    },
    onAsteroidState: (message) => {
      if (activeGame) {
        activeGame.asteroids = message.asteroids
      }
    },
    onScoreState: (message) => {
      if (activeGame) {
        const previousScores = activeGame.scores

        activeGame.scores = message.scores
        renderScorePanel(message.scores, previousScores)
      }
    },
    onLifeState: (message) => {
      if (activeGame) {
        activeGame.lives = message.lives
        renderPlayerHeader()
      }
    },
    onGameOver: (message) => {
      if (activeGame) {
        activeGame.isGameOver = true
        activeGame.scores = message.scores
        activeGame.lives = message.lives
        renderPlayerHeader()
        renderScorePanel(message.scores)
        renderGameOver(message.scores, message.asteroidStats)
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
