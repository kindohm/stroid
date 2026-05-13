import { gameConfig } from "../../shared/game-config"
import type { PlayerShip } from "../../shared/game-types"
import type { NetworkPlayerShip } from "../../shared/lobby-types"

const smoothNumber = (current: number, target: number, deltaSeconds: number) => {
  const amount = 1 - Math.exp(-gameConfig.remotePlayerSmoothingPerSecond * deltaSeconds)

  return current + (target - current) * amount
}

const lerp = (from: number, to: number, amount: number) => from + (to - from) * amount

export const smoothShip = (current: PlayerShip, target: NetworkPlayerShip, deltaSeconds: number): PlayerShip => ({
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

export const interpolateShip = (from: PlayerShip, to: PlayerShip, amount: number): PlayerShip => ({
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
