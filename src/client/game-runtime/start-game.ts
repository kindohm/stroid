import { createProjectile } from "../../game/create-projectile"
import { createStartingPlayerShip } from "../../game/create-starting-player-ship"
import { updateProjectiles } from "../../game/update-projectiles"
import { updatePlayer } from "../../game/update-player"
import { gameConfig } from "../../shared/game-config"
import type { PlayerShip, PowerUpType, Projectile } from "../../shared/game-types"
import type { LobbyPlayer } from "../../shared/lobby-types"
import { createGameWorld, type RoomSettings } from "../../shared/room-settings"
import type { AppState } from "../app/app-state"
import { createKeyboardInput } from "../input/create-keyboard-input"
import { renderGame, type RenderExplosion } from "../render/render-game"
import { createEmptyScoreState, createInitialLifeState, getLife, isPlayerEliminated } from "./player-life"
import { resizeCanvas } from "./resize-canvas"
import { interpolateShip, smoothShip } from "./ship-interpolation"
import { updatePlayerStats } from "../stats/player-stats"
import { chooseFollowedPlayerId } from "./start-game/choose-followed-player-id"
import { createGameCleanup } from "./start-game/create-game-cleanup"
import { createLocalPlayerView } from "./start-game/create-local-player-view"
import { createRenderPlayers } from "./start-game/create-render-players"
import { createShipStore } from "./start-game/create-ship-store"
import { getGhostMarkers } from "./start-game/get-ghost-markers"
import type { LocalShipStatus } from "./start-game/local-ship-status"
import { renderGameShell } from "./start-game/render-game-shell"
import { updateExplosions } from "./start-game/update-explosions"

type StartGameOptions = {
  isSpectator?: boolean
}

export const startGame = (
  state: AppState,
  players: LobbyPlayer[],
  selfId: string,
  settings: RoomSettings,
  options: StartGameOptions = {}
) => {
  const isSpectator = options.isSpectator === true || !players.some((player) => player.id === selfId)

  state.gameCleanup?.()
  cancelAnimationFrame(state.animationFrame)
  state.keyboard?.destroy()
  state.keyboard = undefined

  state.activeGame = {
    selfId,
    isSpectator,
    players,
    remoteTargets: new Map(),
    asteroids: [],
    bossPreSpawnActive: false,
    nextBossWindowAt: Date.now() + settings.bossIntervalMinutes * 60 * 1000,
    bossIntervalMs: settings.bossIntervalMinutes * 60 * 1000,
    powerUps: [],
    gravityWells: [],
    powerUpEffects: [],
    settings,
    scores: createEmptyScoreState(players),
    lives: createInitialLifeState(players, settings.playerLives),
    isGameOver: false
  }
  const world = createGameWorld(settings)
  state.currentUsername = players.find((player) => player.id === selfId)?.username ?? state.currentUsername

  const { canvas, context } = renderGameShell({
    isSpectator,
    scores: state.activeGame.scores,
    state
  })

  const self = players.find((player) => player.id === selfId) ?? players[0]

  if (!self) {
    throw new Error("Cannot start game without players")
  }

  const ships = createShipStore(world)
  let projectiles: Projectile[] = []
  const localProjectileIds = new Set<string>()
  state.incomingProjectiles = []
  state.incomingExplosions = []
  state.hiddenPlayerIds.clear()
  let lastFireTime = -Infinity
  let projectileId = 0
  let lastTime = performance.now()
  let localSimulationAccumulator = 0
  const pendingRevivePlayerIds = new Set<string>()
  const localSimulationStepSeconds = 1 / 120
  let lastPlayerStateSent = 0
  state.keyboard = createKeyboardInput(window)
  ships.syncShips(players)
  const initialObservedPlayerId = isSpectator ? self.id : selfId
  const initialLocalShip =
    ships.get(initialObservedPlayerId) ??
    createStartingPlayerShip(0, Math.max(1, players.length), world)

  if (!initialLocalShip) {
    throw new Error("Local ship failed to initialize")
  }

  let previousLocalShip: PlayerShip = initialLocalShip
  let localShipStatus: LocalShipStatus = isSpectator ? "spectating" : "alive"
  let localLives: number = settings.playerLives
  let respawnAt = 0
  let invincibleUntil = performance.now() + gameConfig.playerSpawnInvincibilitySeconds * 1000
  let followedPlayerId: string | undefined = isSpectator ? initialObservedPlayerId : undefined
  let explosions: RenderExplosion[] = []

  const hasPowerUpEffect = (playerId: string, type: PowerUpType) =>
    state.activeGame?.powerUpEffects.some(
      (effect) => effect.playerId === playerId && effect.type === type && effect.expiresAt > Date.now()
    ) ?? false

  const onResize = () => resizeCanvas(canvas, context)
  window.addEventListener("resize", onResize)
  state.gameCleanup = createGameCleanup({ onResize, state })
  onResize()

  const createRespawnShip = () => {
    const gamePlayers = state.activeGame?.players ?? players
    const selfIndex = Math.max(0, gamePlayers.findIndex((player) => player.id === selfId))

    return createStartingPlayerShip(selfIndex, gamePlayers.length, world)
  }

  const destroyLocalShip = (
    ship: PlayerShip,
    now: number,
    isThrusting: boolean,
    cause: "asteroid" | "friendlyProjectile" | "shipCollision"
  ) => {
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
    }, cause)
    state.gameAudio?.playPlayerExplosion()
    updatePlayerStats({
      deathsByCause: {
        [cause]: 1
      }
    })

    if (localLives <= 0) {
      localShipStatus = "eliminated"
      followedPlayerId = chooseFollowedPlayerId({
        followedPlayerId,
        lives: state.activeGame?.lives,
        players: state.activeGame?.players ?? players,
        selfId
      })
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
    explosions = updateExplosions(explosions, state.incomingExplosions, deltaSeconds)
    state.incomingExplosions = []

    const observedPlayerId = isSpectator
      ? chooseFollowedPlayerId({
          followedPlayerId,
          lives: state.activeGame?.lives,
          players: state.activeGame?.players ?? players,
          selfId
        })
      : selfId

    if (isSpectator) {
      followedPlayerId = observedPlayerId
    }

    const localShip =
      ships.get(observedPlayerId ?? selfId) ??
      ships.get(selfId) ??
      previousLocalShip

    if (!localShip) {
      throw new Error("Local ship is missing")
    }

    const serverLife = getLife(state.activeGame?.lives, selfId)

    if (!isSpectator && serverLife) {
      localLives = serverLife.lives

      if (serverLife.isEliminated) {
        localShipStatus = "eliminated"
      } else if (localShipStatus === "eliminated") {
        localShipStatus = "destroyed"
        respawnAt = now
        followedPlayerId = undefined
      }
    }

    if (localShipStatus === "destroyed" && now >= respawnAt) {
      const respawnShip = createRespawnShip()

      previousLocalShip = respawnShip
      localShipStatus = "alive"
      invincibleUntil = now + gameConfig.playerSpawnInvincibilitySeconds * 1000
      localSimulationAccumulator = 0
      ships.set(selfId, respawnShip)
    }

    let updatedLocalShip = isSpectator
      ? localShip
      : ships.get(selfId) ?? localShip
    const canControlLocalShip = !isSpectator && localShipStatus === "alive" && !state.activeGame?.isGameOver

    const gravityWells = state.activeGame?.gravityWells ?? []

    if (canControlLocalShip) {
      updatePlayerStats({
        thrustSeconds: input.thrust ? deltaSeconds : 0,
        rotationSeconds: input.turnLeft || input.turnRight ? deltaSeconds : 0
      })
    }

    if (canControlLocalShip) {
      localSimulationAccumulator = Math.min(
        localSimulationAccumulator + deltaSeconds,
        localSimulationStepSeconds * 5
      )

      while (localSimulationAccumulator >= localSimulationStepSeconds) {
        previousLocalShip = updatedLocalShip
        updatedLocalShip = updatePlayer(
          updatedLocalShip,
          input,
          localSimulationStepSeconds,
          world,
          settings.maxShipSpeed,
          gravityWells
        )
        localSimulationAccumulator -= localSimulationStepSeconds
      }
    }

    if (!isSpectator) {
      ships.set(selfId, updatedLocalShip)
    }
    projectiles = updateProjectiles(projectiles, deltaSeconds, world, gravityWells)

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
    const boss = state.activeGame?.boss
    const powerUps = state.activeGame?.powerUps ?? []
    const ghostMarkers = getGhostMarkers(state.activeGame?.lives)
    ships.syncShips(gamePlayers)

    const activeGhostPlayerIds = new Set(
      (state.activeGame?.lives.players ?? [])
        .filter((player) => player.isEliminated && player.ghostPosition)
        .map((player) => player.id)
    )

    pendingRevivePlayerIds.forEach((playerId) => {
      if (!activeGhostPlayerIds.has(playerId)) {
        pendingRevivePlayerIds.delete(playerId)
      }
    })

    state.activeGame?.remoteTargets.forEach((ship, playerId) => {
      const currentShip = ships.get(playerId)

      if (currentShip && playerId !== selfId) {
        ships.set(playerId, smoothShip(currentShip, ship, deltaSeconds))
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

    const fireCooldownSeconds = hasPowerUpEffect(selfId, "rapidFire")
      ? gameConfig.fireCooldownSeconds / 2
      : gameConfig.fireCooldownSeconds

    if (canControlLocalShip && input.fire && now / 1000 - lastFireTime >= fireCooldownSeconds) {
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
      updatePlayerStats({
        shotsFired: firedProjectiles.length
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
        updatePlayerStats({
          asteroidsHit: 1,
          asteroidHitsBySize: {
            [asteroid.size]: 1
          },
          asteroidHitsByName: asteroid.name
            ? {
                [asteroid.name]: 1
              }
            : undefined
        })
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
        updatePlayerStats({
          powerUpsCollected: {
            [powerUp.type]: 1
          }
        })
        state.lobbyConnection?.sendPowerUpHit(powerUp.id)
      }
    })
    if (boss) {
      const projectile = projectiles.find(
        (nextProjectile) =>
          localProjectileIds.has(nextProjectile.id) &&
          !hitProjectileIds.has(nextProjectile.id) &&
          Math.hypot(nextProjectile.position.x - boss.position.x, nextProjectile.position.y - boss.position.y) <=
            boss.radius + gameConfig.projectileRadius
      )

      if (projectile) {
        hitProjectileIds.add(projectile.id)
        localProjectileIds.delete(projectile.id)
        updatePlayerStats({
          asteroidsHit: 1,
          bossHits: 1
        })
        state.lobbyConnection?.sendBossHit(boss.id)
      }
    }

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
      destroyLocalShip(updatedLocalShip, now, input.thrust, "friendlyProjectile")
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
        destroyLocalShip(updatedLocalShip, now, input.thrust, "asteroid")
      }

      if (
        boss &&
        Math.hypot(
          updatedLocalShip.position.x - boss.position.x,
          updatedLocalShip.position.y - boss.position.y
        ) <= boss.radius + gameConfig.shipRadius
      ) {
        destroyLocalShip(updatedLocalShip, now, input.thrust, "asteroid")
      }
    }

    if (canLocalTakeFriendlyHit) {
      const hitPlayer = gamePlayers
        .filter((player) => player.id !== selfId && !isPlayerEliminated(state.activeGame?.lives, player.id))
        .find((player) => {
          const ship = ships.get(player.id)

          return Boolean(
            ship &&
              Math.hypot(ship.position.x - updatedLocalShip.position.x, ship.position.y - updatedLocalShip.position.y) <=
                gameConfig.shipRadius * 2
          )
        })

      if (hitPlayer) {
        destroyLocalShip(updatedLocalShip, now, input.thrust, "shipCollision")
      }
    }

    if (canControlLocalShip) {
      const ghostLives = state.activeGame?.lives.players ?? []

      ghostLives
        .filter((player) => player.id !== selfId && player.isEliminated && player.ghostPosition)
        .forEach((player) => {
          const ghostPosition = player.ghostPosition

          if (!ghostPosition || pendingRevivePlayerIds.has(player.id)) {
            return
          }

          if (
            Math.hypot(
              updatedLocalShip.position.x - ghostPosition.x,
              updatedLocalShip.position.y - ghostPosition.y
            ) <= gameConfig.shipRadius + 40
          ) {
            pendingRevivePlayerIds.add(player.id)
            state.lobbyConnection?.sendRevivePlayer(player.id)
          }
        })
    }

    state.gameAudio?.setThrusting(canControlLocalShip && input.thrust)

    if (localShipStatus === "eliminated" || isSpectator) {
      followedPlayerId = chooseFollowedPlayerId({
        followedPlayerId,
        lives: state.activeGame?.lives,
        players: gamePlayers,
        selfId
      })
    }

    const renderPlayers = createRenderPlayers({
      followedPlayerId,
      hasShield: (playerId) => hasPowerUpEffect(playerId, "shield"),
      hiddenPlayerIds: state.hiddenPlayerIds,
      inputThrust: input.thrust,
      invincibleUntil,
      isSpectator,
      lives: state.activeGame?.lives,
      localRenderShip,
      localShipStatus,
      now,
      players: gamePlayers,
      remoteTargets: state.activeGame?.remoteTargets ?? new Map(),
      selfId,
      shipsByPlayerId: ships,
      updatedLocalShip
    })
    const followedPlayer = gamePlayers.find((player) => player.id === followedPlayerId)
    const followedShip = followedPlayer ? ships.get(followedPlayer.id) : undefined
    const localPlayer = createLocalPlayerView({
      canControlLocalShip,
      followedPlayer,
      followedShip,
      hasShield: (playerId) => hasPowerUpEffect(playerId, "shield"),
      inputThrust: input.thrust,
      invincibleUntil,
      isSpectator,
      localRenderShip,
      localShipStatus,
      now,
      selfId,
      selfPlayer
    })

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
      boss,
      bossCountdown: state.activeGame
        ? {
            preSpawnActive: state.activeGame.bossPreSpawnActive,
            nextBossWindowAt: state.activeGame.nextBossWindowAt,
            intervalMs: state.activeGame.bossIntervalMs,
            now: Date.now()
          }
        : undefined,
      powerUps,
      gravityWells,
      ghostMarkers,
      explosions,
      isSpectator,
      timeSeconds: now / 1000
    })

    state.animationFrame = requestAnimationFrame(tick)
  }

  state.animationFrame = requestAnimationFrame(tick)
}
