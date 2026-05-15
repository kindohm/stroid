import type { AppState } from "../../app/app-state"
import { setRoute } from "../../app/route"
import { startGame } from "../../game-runtime/start-game"
import { renderGameOver } from "../../ui/render-game-over"
import { renderPlayerHeader } from "../../ui/render-player-header"
import { renderScorePanel } from "../../ui/render-score-panel"
import { loadPlayerStats, updatePlayerStats } from "../../stats/player-stats"
import type { CreateLobbyConnectionArgs } from "../create-lobby-connection"
import { asteroidExplosionColorBySize, powerUpExplosionColorByType } from "./lobby-explosion-colors"
import type { LobbyRenderModel } from "./lobby-render-model"
import { updateActiveGameFromLobbyState } from "./update-active-game-from-lobby-state"

type CreateLobbyMessageHandlersArgs = {
  model: LobbyRenderModel
  render: () => void
  state: AppState
}

export const createLobbyMessageHandlers = ({
  model,
  render,
  state
}: CreateLobbyMessageHandlersArgs): CreateLobbyConnectionArgs => ({
  onUsernameAccepted: (message) => {
    state.currentUsername = message.username
    renderPlayerHeader(state)

    if (model.pendingSlug) {
      state.lobbyConnection?.join(model.pendingSlug)
      model.statusMessage = `joining ${model.pendingSlug}`
      return
    }

    model.view = "browser"
    state.lobbyConnection?.listLobbies()
    render()
  },
  onUsernameRejected: () => {
    model.statusMessage = "username required"
    model.view = "username"
    render()
  },
  onLobbyList: (message) => {
    model.lobbies = message.lobbies
    if (model.view === "browser") {
      render()
    }
  },
  onLobbyCreated: (message) => {
    state.currentLobbySlug = message.lobby.slug
    state.currentLobbyHostId = message.lobby.hostId
    setRoute(message.lobby.slug)
    model.view = "room"
    render()
  },
  onLobbyNotFound: (message) => {
    model.statusMessage = `${message.slug} does not exist or already closed`
    model.pendingSlug = undefined
    model.view = "notFound"
    render()
  },
  onLobbyJoinRejected: (message) => {
    model.statusMessage =
      message.reason === "missingUsername"
        ? "username required"
        : "lobby does not exist or already closed"
    model.view = message.reason === "notFound" ? "notFound" : "browser"
    render()
  },
  onState: (message) => {
    model.selfId = message.selfId
    state.currentLobbySlug = message.slug
    state.currentLobbyHostId = message.hostId
    model.lobbyPlayers = message.players
    model.asteroidNames = message.asteroidNames
    model.roomSettings = message.settings
    state.currentUsername =
      message.players.find((player) => player.id === message.selfId)?.username ?? state.currentUsername
    model.pendingSlug = undefined
    setRoute(message.slug)
    model.view = "room"
    updateActiveGameFromLobbyState(state, model)
    renderPlayerHeader(state)
    if (!state.activeGame) {
      render()
    }
  },
  onGameStarted: (message) => {
    state.currentLobbySlug = message.slug
    state.currentLobbyHostId = message.hostId
    model.roomSettings = message.settings
    startGame(state, message.players, message.selfId, message.settings, {
      isSpectator: message.isSpectator
    })
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
  onBossState: (message) => {
    if (state.activeGame) {
      state.activeGame.boss = message.boss
      state.activeGame.bossPreSpawnActive = message.preSpawnActive
      state.activeGame.nextBossWindowAt = message.nextBossWindowAt
      state.activeGame.bossIntervalMs = message.bossIntervalMs
    }
  },
  onBossHit: (message) => {
    if (state.activeGame) {
      state.activeGame.boss = message.boss
      state.gameAudio?.playAsteroidDestroyed()
      updatePlayerStats({
        bossDefeats: 1
      })
    }
  },
  onBossDefeated: (message) => {
    if (state.activeGame) {
      state.activeGame.boss = undefined
      state.activeGame.bossPreSpawnActive = false
      state.incomingExplosions = [
        ...state.incomingExplosions,
        {
          position: message.boss.position,
          color: "#fff4a6",
          ageSeconds: 0
        }
      ]
      state.gameAudio?.playAsteroidDestroyed()
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
      updatePlayerStats({
        bestGameScore: message.scores.players.find((player) => player.id === state.activeGame?.selfId)?.score ?? 0
      })
      state.lobbyConnection?.setPlayerStats(loadPlayerStats())
      renderPlayerHeader(state)
      renderScorePanel(message.scores)
      renderGameOver(state, message.scores, message.asteroidStats, message.recap, () => {
        state.gameCleanup?.()
        state.activeGame = undefined
        document.querySelector(".game-over-panel")?.remove()
        render()
      })
    }
  },
  onStatus: (nextStatus) => {
    model.connectionStatus = nextStatus
    if (state.currentUsername && nextStatus === "connected") {
      state.lobbyConnection?.setUsername(state.currentUsername)
    }
    render()
  }
})
