import { describe, expect, it } from "vitest"
import { gameConfig } from "../shared/game-config"
import type { PlayerInput, PlayerShip } from "../shared/game-types"
import { updatePlayer } from "./update-player"

const world = {
  width: gameConfig.mapTilesWide * gameConfig.tileSize,
  height: gameConfig.mapTilesTall * gameConfig.tileSize
}

const idleInput: PlayerInput = {
  thrust: false,
  turnLeft: false,
  turnRight: false,
  fire: false
}

const createPlayer = (overrides: Partial<PlayerShip> = {}): PlayerShip => ({
  position: {
    x: world.width / 2,
    y: world.height / 2
  },
  velocity: {
    x: 0,
    y: 0
  },
  angle: 0,
  ...overrides
})

describe("updatePlayer", () => {
  it("turns left and right", () => {
    const left = updatePlayer(createPlayer(), { ...idleInput, turnLeft: true }, 0.5, world)
    const right = updatePlayer(createPlayer(), { ...idleInput, turnRight: true }, 0.5, world)

    expect(left.angle).toBeLessThan(0)
    expect(right.angle).toBeGreaterThan(0)
    expect(Math.abs(left.angle)).toBeCloseTo(right.angle)
  })

  it("thrusts along the facing angle", () => {
    const player = createPlayer({
      angle: -Math.PI / 2
    })
    const updated = updatePlayer(player, { ...idleInput, thrust: true }, 1, world)

    expect(updated.velocity.x).toBeCloseTo(0)
    expect(updated.velocity.y).toBeLessThan(0)
    expect(updated.position.y).toBeLessThan(player.position.y)
  })

  it("drifts from existing velocity", () => {
    const player = createPlayer({
      velocity: {
        x: 100,
        y: 50
      }
    })
    const updated = updatePlayer(player, idleInput, 0.25, world)

    expect(updated.position.x).toBeGreaterThan(player.position.x)
    expect(updated.position.y).toBeGreaterThan(player.position.y)
  })

  it("bounces off the map edge", () => {
    const player = createPlayer({
      position: {
        x: 4,
        y: 4
      },
      velocity: {
        x: -1000,
        y: -1000
      }
    })
    const updated = updatePlayer(player, idleInput, 1, world)

    expect(updated.position.x).toBe(gameConfig.shipRadius)
    expect(updated.position.y).toBe(gameConfig.shipRadius)
    expect(updated.velocity.x).toBeGreaterThan(0)
    expect(updated.velocity.y).toBeGreaterThan(0)
    expect(updated.velocity.x).toBeCloseTo(1000 * (1 - gameConfig.dragPerSecond) * gameConfig.wallBounceVelocityRetained)
    expect(updated.velocity.y).toBeCloseTo(1000 * (1 - gameConfig.dragPerSecond) * gameConfig.wallBounceVelocityRetained)
  })
})
