import { createProjectile } from "../../game/create-projectile"
import { createStartingPlayerShip } from "../../game/create-starting-player-ship"
import { updateProjectiles } from "../../game/update-projectiles"
import { updatePlayer } from "../../game/update-player"
import { gameConfig } from "../../shared/game-config"
import type { PlayerShip, Projectile } from "../../shared/game-types"
import type { LobbyPlayer } from "../../shared/lobby-types"
import { createGameWorld, type RoomSettings } from "../../shared/room-settings"
import type { AppState } from "../app/app-state"
import { createKeyboardInput } from "../input/create-keyboard-input"
import { renderGame, type RenderExplosion } from "../render/render-game"
import { createGameAudio } from "../audio/create-game-audio"
import { renderAudioControls } from "../audio/render-audio-controls"
import { isRenderPlayerVisible } from "./is-render-player-visible"
import { createEmptyScoreState, createInitialLifeState, getLife, isPlayerEliminated } from "./player-life"
import { resizeCanvas } from "./resize-canvas"
import { interpolateShip, smoothShip } from "./ship-interpolation"
import { renderPlayerHeader } from "../ui/render-player-header"
import { renderScorePanel } from "../ui/render-score-panel"

export const startGame = (state: AppState, players: LobbyPlayer[], selfId: string, settings: RoomSettings) => {
  state.gameCleanup?.()
  cancelAnimationFrame(state.animationFrame)
  state.keyboard?.destroy()
  state.keyboard = undefined

  state.activeGame = {
    selfId,
    players,
    remoteTargets: new Map(),
    asteroids: [],
    powerUps: [],
    powerUpEffects: [],
    settings,
    scores: createEmptyScoreState(players),
    lives: createInitialLifeState(players, settings.playerLives),
    isGameOver: false
  }
  const world = createGameWorld(settings)
  state.currentUsername = players.find((player) => player.id === selfId)?.username ?? state.currentUsername

  state.app.innerHTML = `
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
  renderPlayerHeader(state)
  renderScorePanel(state.activeGame.scores)
  state.gameAudio?.destroy()
  state.gameAudio = createGameAudio()
  renderAudioControls(state.gameAudio)

  const canvas = state.app.querySelector<HTMLCanvasElement>("canvas")
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
        shipsByPlayerId.set(lobbyPlayer.id, createStartingPlayerShip(index, nextPlayers.length, world))
      }
    })
  }
  let projectiles: Projectile[] = []
  const localProjectileIds = new Set<string>()
  state.incomingProjectiles = []
  state.incomingExplosions = []
  state.hiddenPlayerIds.clear()
  let lastFireTime = -Infinity
  let projectileId = 0
  let lastTime = performance.now()
  let localSimulationAccumulator = 0
  const localSimulationStepSeconds = 1 / 120
  let lastPlayerStateSent = 0
  state.keyboard = createKeyboardInput(window)
  syncShips(players)
  const initialLocalShip = shipsByPlayerId.get(selfId)

  if (!initialLocalShip) {
    throw new Error("Local ship failed to initialize")
  }

  let previousLocalShip: PlayerShip = initialLocalShip
  let localShipStatus: "alive" | "destroyed" | "eliminated" = "alive"
  let localLives: number = settings.playerLives
  let respawnAt = 0
  let invincibleUntil = performance.now() + gameConfig.playerSpawnInvincibilitySeconds * 1000
  let followedPlayerId: string | undefined
  let explosions: RenderExplosion[] = []

  const hasPowerUpEffect = (playerId: string, type: "shield" | "scatterShot" | "asteroidFreeze") =>
    state.activeGame?.powerUpEffects.some(
      (effect) => effect.playerId === playerId && effect.type === type && effect.expiresAt > Date.now()
    ) ?? false

  const onResize = () => resizeCanvas(canvas, context)
  window.addEventListener("resize", onResize)
  state.gameCleanup = () => {
    window.removeEventListener("resize", onResize)
    cancelAnimationFrame(state.animationFrame)
    document.querySelector(".audio-panel")?.remove()
    state.gameAudio?.setThrusting(false)
    state.gameAudio?.destroy()
    state.gameAudio = undefined
    state.keyboard?.destroy()
    state.keyboard = undefined
    state.gameCleanup = undefined
  }
  onResize()

  const createRespawnShip = () => {
    const gamePlayers = state.activeGame?.players ?? players
    const selfIndex = Math.max(0, gamePlayers.findIndex((player) => player.id === selfId))

    return createStartingPlayerShip(selfIndex, gamePlayers.length, world)
  }

  const chooseFollowedPlayerId = (gamePlayers: LobbyPlayer[]) => {
    if (
      followedPlayerId &&
      gamePlayers.some((player) => player.id === followedPlayerId && !isPlayerEliminated(state.activeGame?.lives, player.id))
    ) {
      return followedPlayerId
    }

    return gamePlayers.find((player) => player.id !== selfId && !isPlayerEliminated(state.activeGame?.lives, player.id))?.id
  }

  const destroyLocalShip = (ship: PlayerShip, now: number, isThrusting: boolean) => {
    if (localShipStatus !== "alive" || now < invincibleUntil || state.activeGame?.isGameOver) {
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
    state.lobbyConnection?.sendPlayerHit({
      position: ship.position,
      velocity: ship.velocity,
      angle: ship.angle,
      isThrusting
    })
    state.gameAudio?.playPlayerExplosion()

    if (localLives <= 0) {
      localShipStatus = "eliminated"
      followedPlayerId = chooseFollowedPlayerId(state.activeGame?.players ?? players)
      return
    }

    localShipStatus = "destroyed"
    respawnAt = now + gameConfig.playerRespawnDelaySeconds * 1000
  }

  const tick = (now: number) => {
    const deltaSeconds = Math.min(0.05, (now - lastTime) / 1000)
    lastTime = now
    const input = state.keyboard?.read() ?? {
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

    if (state.incomingExplosions.length > 0) {
      explosions = [
        ...explosions,
        ...state.incomingExplosions
      ]
      state.incomingExplosions = []
    }

    const localShip = shipsByPlayerId.get(selfId)

    if (!localShip) {
      throw new Error("Local ship is missing")
    }

    const serverLife = getLife(state.activeGame?.lives, selfId)

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
    const canControlLocalShip = localShipStatus === "alive" && !state.activeGame?.isGameOver

    if (canControlLocalShip) {
      localSimulationAccumulator = Math.min(
        localSimulationAccumulator + deltaSeconds,
        localSimulationStepSeconds * 5
      )

      while (localSimulationAccumulator >= localSimulationStepSeconds) {
        previousLocalShip = updatedLocalShip
        updatedLocalShip = updatePlayer(updatedLocalShip, input, localSimulationStepSeconds, world, settings.maxShipSpeed)
        localSimulationAccumulator -= localSimulationStepSeconds
      }
    }

    shipsByPlayerId.set(selfId, updatedLocalShip)
    projectiles = updateProjectiles(projectiles, deltaSeconds, world)

    if (state.incomingProjectiles.length > 0) {
      const nextProjectiles = state.incomingProjectiles

      state.incomingProjectiles = []
      projectiles = [
        ...projectiles.filter(
          (projectile) => !nextProjectiles.some((nextProjectile) => nextProjectile.id === projectile.id)
        ),
        ...nextProjectiles
      ]
    }

    const liveProjectileIds = new Set(projectiles.map((projectile) => projectile.id))

    localProjectileIds.forEach((projectileIdToCheck) => {
      if (!liveProjectileIds.has(projectileIdToCheck)) {
        localProjectileIds.delete(projectileIdToCheck)
      }
    })

    const gamePlayers = state.activeGame?.players ?? players
    const selfPlayer = gamePlayers.find((lobbyPlayer) => lobbyPlayer.id === selfId) ?? self
    const asteroids = state.activeGame?.asteroids ?? []
    const powerUps = state.activeGame?.powerUps ?? []
    syncShips(gamePlayers)

    state.activeGame?.remoteTargets.forEach((ship, playerId) => {
      const currentShip = shipsByPlayerId.get(playerId)

      if (currentShip && playerId !== selfId) {
        shipsByPlayerId.set(playerId, smoothShip(currentShip, ship, deltaSeconds))
      }
    })

    if (canControlLocalShip && now - lastPlayerStateSent >= gameConfig.playerStateSendIntervalMs) {
      lastPlayerStateSent = now
      state.lobbyConnection?.sendPlayerState({
        position: updatedLocalShip.position,
        velocity: updatedLocalShip.velocity,
        angle: updatedLocalShip.angle,
        isThrusting: input.thrust
      })
    }

    if (canControlLocalShip && input.fire && now / 1000 - lastFireTime >= gameConfig.fireCooldownSeconds) {
      lastFireTime = now / 1000
      state.gameAudio?.playFire()
      const projectileAngles = hasPowerUpEffect(selfId, "scatterShot")
        ? [-0.18, 0, 0.18]
        : [0]
      const firedProjectiles = projectileAngles.map((angleOffset) => {
        projectileId += 1

        return createProjectile(
          `${selfPlayer.username}-${projectileId}`,
          selfPlayer.username,
          selfPlayer.color,
          {
            ...updatedLocalShip,
            angle: updatedLocalShip.angle + angleOffset
          }
        )
      })

      firedProjectiles.forEach((projectile) => {
        localProjectileIds.add(projectile.id)
        state.lobbyConnection?.sendProjectileFired(projectile)
      })
      projectiles = [
        ...projectiles,
        ...firedProjectiles
      ]
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
        state.lobbyConnection?.sendAsteroidHit(asteroid.id)
      }
    })
    powerUps.forEach((powerUp) => {
      const projectile = projectiles.find(
        (nextProjectile) =>
          localProjectileIds.has(nextProjectile.id) &&
          !hitProjectileIds.has(nextProjectile.id) &&
          Math.hypot(nextProjectile.position.x - powerUp.position.x, nextProjectile.position.y - powerUp.position.y) <=
            powerUp.radius + gameConfig.projectileRadius
      )

      if (projectile) {
        hitProjectileIds.add(projectile.id)
        localProjectileIds.delete(projectile.id)
        state.lobbyConnection?.sendPowerUpHit(powerUp.id)
      }
    })

    const canLocalTakeFriendlyHit =
      settings.friendlyFire && canControlLocalShip && now >= invincibleUntil && !hasPowerUpEffect(selfId, "shield")
    const friendlyProjectile = canLocalTakeFriendlyHit
      ? projectiles.find(
          (projectile) =>
            !localProjectileIds.has(projectile.id) &&
            projectile.owner !== selfPlayer.username &&
            Math.hypot(projectile.position.x - updatedLocalShip.position.x, projectile.position.y - updatedLocalShip.position.y) <=
              gameConfig.shipRadius + gameConfig.projectileRadius
        )
      : undefined

    if (friendlyProjectile) {
      hitProjectileIds.add(friendlyProjectile.id)
      destroyLocalShip(updatedLocalShip, now, input.thrust)
    }

    projectiles = projectiles.filter((projectile) => !hitProjectileIds.has(projectile.id))

    if (canControlLocalShip && now >= invincibleUntil && !hasPowerUpEffect(selfId, "shield")) {
      const hitAsteroid = asteroids.find(
        (asteroid) =>
          Math.hypot(
            updatedLocalShip.position.x - asteroid.position.x,
            updatedLocalShip.position.y - asteroid.position.y
          ) <= asteroid.radius + gameConfig.shipRadius
      )

      if (hitAsteroid) {
        destroyLocalShip(updatedLocalShip, now, input.thrust)
      }
    }

    if (canLocalTakeFriendlyHit) {
      const hitPlayer = gamePlayers
        .filter((player) => player.id !== selfId && !isPlayerEliminated(state.activeGame?.lives, player.id))
        .find((player) => {
          const ship = shipsByPlayerId.get(player.id)

          return Boolean(
            ship &&
              Math.hypot(ship.position.x - updatedLocalShip.position.x, ship.position.y - updatedLocalShip.position.y) <=
                gameConfig.shipRadius * 2
          )
        })

      if (hitPlayer) {
        destroyLocalShip(updatedLocalShip, now, input.thrust)
      }
    }

    state.gameAudio?.setThrusting(canControlLocalShip && input.thrust)

    if (localShipStatus === "eliminated") {
      followedPlayerId = chooseFollowedPlayerId(gamePlayers)
    }

    const renderPlayers = gamePlayers
      .filter((lobbyPlayer) =>
        isRenderPlayerVisible(lobbyPlayer, selfId, localShipStatus, state.activeGame?.lives, state.hiddenPlayerIds)
      )
      .map((lobbyPlayer) => ({
        username: lobbyPlayer.username,
        ship: lobbyPlayer.id === selfId
          ? localRenderShip
          : shipsByPlayerId.get(lobbyPlayer.id) ?? updatedLocalShip,
        color: lobbyPlayer.color,
        isThrusting:
          lobbyPlayer.id === selfId
            ? input.thrust
            : state.activeGame?.remoteTargets.get(lobbyPlayer.id)?.isThrusting ?? false,
        isLocal: lobbyPlayer.id === selfId,
        isInvincible: lobbyPlayer.id === selfId
          ? localShipStatus === "alive" && (now < invincibleUntil || hasPowerUpEffect(lobbyPlayer.id, "shield"))
          : hasPowerUpEffect(lobbyPlayer.id, "shield")
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
          isInvincible: localShipStatus === "alive" && (now < invincibleUntil || hasPowerUpEffect(selfId, "shield")),
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
      powerUps,
      explosions,
      timeSeconds: now / 1000
    })

    state.animationFrame = requestAnimationFrame(tick)
  }

  state.animationFrame = requestAnimationFrame(tick)
}
