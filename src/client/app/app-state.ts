import type { Asteroid, Projectile } from "../../shared/game-types"
import type { LifeState, LobbyPlayer, NetworkPlayerShip, ScoreState } from "../../shared/lobby-types"
import type { createKeyboardInput } from "../input/create-keyboard-input"
import type { createLobbyConnection } from "../lobby/create-lobby-connection"
import type { RenderExplosion } from "../render/render-game"
import type { GameAudio } from "../audio/create-game-audio"

export type ActiveGame = {
  selfId: string
  players: LobbyPlayer[]
  remoteTargets: Map<string, NetworkPlayerShip>
  asteroids: Asteroid[]
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
