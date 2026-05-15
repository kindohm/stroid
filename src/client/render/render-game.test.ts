import { describe, expect, it } from "vitest"
import { gameConfig } from "../../shared/game-config"
import type { Asteroid, PlayerShip, Vector } from "../../shared/game-types"
import { renderGame } from "./render-game"

type ContextStub = CanvasRenderingContext2D & {
  operations: string[]
}

const createGradientStub = () => ({
  addColorStop: () => undefined
})

const createContextStub = (): ContextStub => {
  const operations: string[] = []
  const context = {
    operations,
    canvas: {},
    clearRect: () => operations.push("clearRect"),
    createRadialGradient: () => createGradientStub(),
    fillRect: () => operations.push("fillRect"),
    beginPath: () => operations.push("beginPath"),
    moveTo: () => operations.push("moveTo"),
    lineTo: () => operations.push("lineTo"),
    arc: () => operations.push("arc"),
    closePath: () => operations.push("closePath"),
    fill: () => operations.push("fill"),
    stroke: () => operations.push("stroke"),
    strokeRect: () => operations.push("strokeRect"),
    roundRect: () => operations.push("roundRect"),
    measureText: (text: string) => ({
      width: text.length * 7
    }),
    save: () => operations.push("save"),
    restore: () => operations.push("restore"),
    translate: () => operations.push("translate"),
    rotate: () => operations.push("rotate"),
    setLineDash: () => operations.push("setLineDash"),
    fillText: (text: string) => operations.push(`fillText:${text}`),
    set fillStyle(_: string | CanvasGradient | CanvasPattern) {},
    set strokeStyle(_: string | CanvasGradient | CanvasPattern) {},
    set shadowColor(_: string) {},
    set shadowBlur(_: number) {},
    set lineWidth(_: number) {},
    set font(_: string) {},
    set textAlign(_: CanvasTextAlign) {},
    set textBaseline(_: CanvasTextBaseline) {},
    set globalAlpha(_: number) {},
    set globalCompositeOperation(value: GlobalCompositeOperation) {
      operations.push(`globalCompositeOperation:${value}`)
    }
  }

  return context as unknown as ContextStub
}

const viewport: Vector = {
  x: 800,
  y: 600
}

const world = {
  width: gameConfig.mapTilesWide * gameConfig.tileSize,
  height: gameConfig.mapTilesTall * gameConfig.tileSize
}

const player: PlayerShip = {
  position: {
    x: world.width / 2,
    y: world.height / 2
  },
  velocity: {
    x: 0,
    y: 0
  },
  angle: -Math.PI / 2
}

const renderPlayer = {
  username: "mike",
  ship: player,
  color: "#74ffe0",
  isThrusting: false
}

const asteroid: Asteroid = {
  id: "a1",
  size: "large",
  radius: gameConfig.asteroidRadius.large,
  position: {
    x: player.position.x + 120,
    y: player.position.y
  },
  velocity: {
    x: 10,
    y: 0
  },
  shape: [1, 0.8, 1.1, 0.9]
}

describe("renderGame", () => {
  it("draws thrust only while the ship is thrusting", () => {
    const idleContext = createContextStub()
    const thrustContext = createContextStub()

    renderGame({
      context: idleContext,
      viewport,
      world,
      localPlayer: renderPlayer,
      players: [renderPlayer],
      projectiles: [],
      asteroids: [],
      explosions: [],
      timeSeconds: 1
    })
    renderGame({
      context: thrustContext,
      viewport,
      world,
      localPlayer: {
        ...renderPlayer,
        isThrusting: true
      },
      players: [
        {
          ...renderPlayer,
          isThrusting: true
        }
      ],
      projectiles: [],
      asteroids: [],
      explosions: [],
      timeSeconds: 1
    })

    expect(idleContext.operations).not.toContain("globalCompositeOperation:lighter")
    expect(thrustContext.operations).toContain("globalCompositeOperation:lighter")
  })

  it("draws the username label near the ship", () => {
    const context = createContextStub()

    renderGame({
      context,
      viewport,
      world,
      localPlayer: renderPlayer,
      players: [renderPlayer],
      projectiles: [],
      asteroids: [],
      explosions: [],
      timeSeconds: 1
    })

    expect(context.operations).toContain("roundRect")
  })

  it("draws username labels for visible remote ships", () => {
    const context = createContextStub()

    renderGame({
      context,
      viewport,
      world,
      localPlayer: {
        ...renderPlayer,
        isLocal: true
      },
      players: [
        {
          ...renderPlayer,
          isLocal: true
        },
        {
          username: "zoe",
          ship: {
            ...player,
            position: {
              x: player.position.x + 90,
              y: player.position.y
            }
          },
          color: "#ff7a90",
          isThrusting: false
        }
      ],
      projectiles: [],
      asteroids: [],
      explosions: [],
      timeSeconds: 1
    })

    expect(context.operations).toContain("fillText:zoe")
  })

  it("draws player markers on the minimap", () => {
    const context = createContextStub()

    renderGame({
      context,
      viewport,
      world,
      localPlayer: renderPlayer,
      players: [
        renderPlayer,
        {
          username: "zoe",
          ship: {
            ...player,
            position: {
              x: world.width * 0.25,
              y: world.height * 0.75
            }
          },
          color: "#ff7a90",
          isThrusting: false
        }
      ],
      projectiles: [],
      asteroids: [],
      explosions: [],
      timeSeconds: 1
    })

    expect(context.operations.filter((operation) => operation === "arc")).toHaveLength(2)
  })

  it("draws projectiles in the world and on the minimap", () => {
    const context = createContextStub()

    renderGame({
      context,
      viewport,
      world,
      localPlayer: renderPlayer,
      players: [renderPlayer],
      projectiles: [
        {
          id: "p1",
          owner: "mike",
          color: "#74ffe0",
          ttlSeconds: 1,
          position: {
            x: player.position.x + 80,
            y: player.position.y
          },
          velocity: {
            x: 100,
            y: 0
          }
        }
      ],
      asteroids: [],
      explosions: [],
      timeSeconds: 1
    })

    expect(context.operations.filter((operation) => operation === "arc")).toHaveLength(3)
  })

  it("draws asteroid geometry and minimap markers", () => {
    const context = createContextStub()

    renderGame({
      context,
      viewport,
      world,
      localPlayer: renderPlayer,
      players: [renderPlayer],
      projectiles: [],
      asteroids: [asteroid],
      explosions: [],
      timeSeconds: 1
    })

    expect(context.operations).toContain("lineTo")
    expect(context.operations.filter((operation) => operation === "arc")).toHaveLength(2)
  })

  it("draws boss geometry and health", () => {
    const context = createContextStub()

    renderGame({
      context,
      viewport,
      world,
      localPlayer: renderPlayer,
      players: [renderPlayer],
      projectiles: [],
      asteroids: [],
      boss: {
        id: "boss-1",
        name: "boss",
        radius: gameConfig.bossRadius,
        health: 12,
        maxHealth: 25,
        position: {
          x: player.position.x + 180,
          y: player.position.y
        },
        velocity: {
          x: 0,
          y: 20
        },
        shape: [1, 0.9, 1.1, 0.95]
      },
      explosions: [],
      timeSeconds: 1
    })

    expect(context.operations).toContain("fillText:boss")
    expect(context.operations).toContain("fillText:boss 12/25")
  })

  it("draws a decreasing boss countdown when boss is waiting", () => {
    const context = createContextStub()

    renderGame({
      context,
      viewport,
      world,
      localPlayer: renderPlayer,
      players: [renderPlayer],
      projectiles: [],
      asteroids: [],
      bossCountdown: {
        preSpawnActive: false,
        nextBossWindowAt: 130_000,
        intervalMs: 180_000,
        now: 100_000
      },
      explosions: [],
      timeSeconds: 1
    })

    expect(context.operations).toContain("fillText:boss window 30s")
  })

  it("draws powerups in the world and on the minimap", () => {
    const context = createContextStub()

    renderGame({
      context,
      viewport,
      world,
      localPlayer: renderPlayer,
      players: [renderPlayer],
      projectiles: [],
      asteroids: [],
      powerUps: [
        {
          id: "power-up-1",
          type: "shield",
          radius: gameConfig.powerUpRadius,
          position: {
            x: player.position.x + 80,
            y: player.position.y
          },
          velocity: {
            x: 120,
            y: 0
          }
        }
      ],
      explosions: [],
      timeSeconds: 1
    })

    expect(context.operations.filter((operation) => operation === "arc").length).toBeGreaterThan(2)
  })

  it("draws revive ghost markers", () => {
    const context = createContextStub()

    renderGame({
      context,
      viewport,
      world,
      localPlayer: renderPlayer,
      players: [renderPlayer],
      projectiles: [],
      asteroids: [],
      ghostMarkers: [
        {
          username: "zoe",
          position: {
            x: player.position.x + 80,
            y: player.position.y
          },
          color: "#ff7a90"
        }
      ],
      explosions: [],
      timeSeconds: 1
    })

    expect(context.operations).toContain("fillText:revive zoe")
  })
})
