import type { ActivePowerUpEffect, Asteroid, BossAsteroid, GravityWell, PowerUp, Projectile } from "../../shared/game-types"
import type { LifeState, LobbyPlayer, NetworkPlayerShip, ScoreState } from "../../shared/lobby-types"
import type { RoomSettings } from "../../shared/room-settings"
import type { createKeyboardInput } from "../input/create-keyboard-input"
import type { createLobbyConnection } from "../lobby/create-lobby-connection"
import type { RenderExplosion } from "../render/render-game"
import type { GameAudio } from "../audio/create-game-audio"

export type ActiveGame = {
  selfId: string
  isSpectator: boolean
  players: LobbyPlayer[]
  remoteTargets: Map<string, NetworkPlayerShip>
  asteroids: Asteroid[]
  boss?: BossAsteroid
  bossPreSpawnActive: boolean
  nextBossWindowAt: number
  bossIntervalMs: number
  powerUps: PowerUp[]
  gravityWells: GravityWell[]
  powerUpEffects: ActivePowerUpEffect[]
  settings: RoomSettings
  scores: ScoreState
  lives: LifeState
  isGameOver: boolean
}

export type AppState = {
  app: HTMLDivElement
  animationFrame: number
  keyboard?: ReturnType<typeof createKeyboardInput>
  lobbyConnection?: ReturnType<typeof createLobbyConnection>
  currentUsername: string
  currentLobbySlug: string
  currentLobbyHostId: string
  incomingProjectiles: Projectile[]
  incomingExplosions: RenderExplosion[]
  hiddenPlayerIds: Set<string>
  gameCleanup?: () => void
  gameAudio?: GameAudio
  activeGame?: ActiveGame
}

export const createAppState = (app: HTMLDivElement): AppState => ({
  app,
  animationFrame: 0,
  currentUsername: "",
  currentLobbySlug: "",
  currentLobbyHostId: "",
  incomingProjectiles: [],
  incomingExplosions: [],
  hiddenPlayerIds: new Set()
})
