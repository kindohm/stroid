import { gameConfig } from "../../shared/game-config"
import type { Asteroid, GameWorld, PlayerShip, Projectile, Vector } from "../../shared/game-types"

export type RenderPlayerView = {
  username: string
  ship: PlayerShip
  color: string
  isThrusting: boolean
}

type RenderGameArgs = {
  context: CanvasRenderingContext2D
  viewport: Vector
  world: GameWorld
  localPlayer: RenderPlayerView
  players: RenderPlayerView[]
  projectiles: Projectile[]
  asteroids: Asteroid[]
  timeSeconds: number
}

const worldToScreen = (point: Vector, camera: Vector, viewport: Vector): Vector => ({
  x: point.x - camera.x + viewport.x / 2,
  y: point.y - camera.y + viewport.y / 2
})

const drawGrid = (
  context: CanvasRenderingContext2D,
  camera: Vector,
  viewport: Vector,
  world: GameWorld
) => {
  const tile = gameConfig.tileSize
  const left = camera.x - viewport.x / 2
  const top = camera.y - viewport.y / 2
  const right = left + viewport.x
  const bottom = top + viewport.y
  const firstX = Math.max(0, Math.floor(left / tile) * tile)
  const firstY = Math.max(0, Math.floor(top / tile) * tile)

  context.strokeStyle = "rgba(116, 255, 224, 0.08)"
  context.lineWidth = 1
  context.beginPath()

  for (let x = firstX; x <= Math.min(world.width, right); x += tile) {
    const screenX = Math.round(worldToScreen({ x, y: 0 }, camera, viewport).x) + 0.5
    context.moveTo(screenX, 0)
    context.lineTo(screenX, viewport.y)
  }

  for (let y = firstY; y <= Math.min(world.height, bottom); y += tile) {
    const screenY = Math.round(worldToScreen({ x: 0, y }, camera, viewport).y) + 0.5
    context.moveTo(0, screenY)
    context.lineTo(viewport.x, screenY)
  }

  context.stroke()
}

const drawBoundary = (
  context: CanvasRenderingContext2D,
  camera: Vector,
  viewport: Vector,
  world: GameWorld
) => {
  const topLeft = worldToScreen({ x: 0, y: 0 }, camera, viewport)

  context.save()
  context.strokeStyle = "rgba(255, 244, 166, 0.58)"
  context.lineWidth = 1.5
  context.setLineDash([2, 8])
  context.strokeRect(topLeft.x, topLeft.y, world.width, world.height)
  context.restore()
}

const drawThrust = (context: CanvasRenderingContext2D, timeSeconds: number) => {
  const pulse = Math.sin(timeSeconds * 48) * 4
  const flare = 27 + pulse

  context.save()
  context.globalCompositeOperation = "lighter"
  context.shadowColor = "rgba(255, 244, 166, 0.92)"
  context.shadowBlur = 18

  context.fillStyle = "rgba(255, 244, 166, 0.82)"
  context.beginPath()
  context.moveTo(-14, -7)
  context.lineTo(-14, 7)
  context.lineTo(-14 - flare, 0)
  context.closePath()
  context.fill()

  context.fillStyle = "rgba(116, 255, 224, 0.54)"
  context.beginPath()
  context.moveTo(-11, -4)
  context.lineTo(-11, 4)
  context.lineTo(-29 - pulse, 0)
  context.closePath()
  context.fill()

  context.restore()
}

const drawShip = (
  context: CanvasRenderingContext2D,
  screenPosition: Vector,
  player: PlayerShip,
  color: string,
  isThrusting: boolean,
  timeSeconds: number
) => {
  context.save()
  context.translate(screenPosition.x, screenPosition.y)
  context.rotate(player.angle)

  if (isThrusting) {
    drawThrust(context, timeSeconds)
  }

  context.strokeStyle = color
  context.fillStyle = "rgba(12, 22, 28, 0.92)"
  context.lineWidth = 2
  context.shadowColor = color
  context.shadowBlur = 14
  context.beginPath()
  context.moveTo(24, 0)
  context.lineTo(-16, -13)
  context.lineTo(-8, 0)
  context.lineTo(-16, 13)
  context.closePath()
  context.fill()
  context.stroke()
  context.restore()
}

const drawShipLabel = (
  context: CanvasRenderingContext2D,
  screenPosition: Vector,
  username: string,
  color: string
) => {
  const x = screenPosition.x
  const y = screenPosition.y - 34

  context.save()
  context.font = "11px ui-monospace, SFMono-Regular, Menlo, monospace"
  context.textAlign = "center"
  context.textBaseline = "middle"
  context.fillStyle = "rgba(5, 7, 10, 0.72)"
  context.strokeStyle = color
  context.globalAlpha = 0.86
  context.lineWidth = 1

  const labelWidth = Math.max(42, context.measureText(username).width + 18)
  context.beginPath()
  context.roundRect(x - labelWidth / 2, y - 10, labelWidth, 20, 4)
  context.fill()
  context.stroke()

  context.fillStyle = "rgba(236, 248, 241, 0.88)"
  context.globalAlpha = 1
  context.fillText(username, x, y + 1)
  context.restore()
}

const drawProjectiles = (
  context: CanvasRenderingContext2D,
  camera: Vector,
  viewport: Vector,
  projectiles: Projectile[]
) => {
  projectiles.forEach((projectile) => {
    const screenPosition = worldToScreen(projectile.position, camera, viewport)

    context.save()
    context.fillStyle = projectile.color
    context.shadowColor = projectile.color
    context.shadowBlur = 12
    context.beginPath()
    context.arc(
      screenPosition.x,
      screenPosition.y,
      gameConfig.projectileRadius,
      0,
      Math.PI * 2
    )
    context.fill()
    context.restore()
  })
}

const drawAsteroids = (
  context: CanvasRenderingContext2D,
  camera: Vector,
  viewport: Vector,
  asteroids: Asteroid[]
) => {
  asteroids.forEach((asteroid) => {
    const screenPosition = worldToScreen(asteroid.position, camera, viewport)
    const step = (Math.PI * 2) / asteroid.shape.length

    context.save()
    context.translate(screenPosition.x, screenPosition.y)
    context.strokeStyle = "rgba(218, 209, 184, 0.82)"
    context.fillStyle = "rgba(72, 75, 68, 0.54)"
    context.lineWidth = 2
    context.shadowColor = "rgba(255, 244, 166, 0.12)"
    context.shadowBlur = 10
    context.beginPath()

    asteroid.shape.forEach((scale, index) => {
      const angle = step * index
      const radius = asteroid.radius * scale
      const x = Math.cos(angle) * radius
      const y = Math.sin(angle) * radius

      if (index === 0) {
        context.moveTo(x, y)
        return
      }

      context.lineTo(x, y)
    })

    context.closePath()
    context.fill()
    context.stroke()
    context.restore()
  })
}

const drawMiniMap = (
  context: CanvasRenderingContext2D,
  viewport: Vector,
  world: GameWorld,
  players: RenderPlayerView[],
  projectiles: Projectile[],
  asteroids: Asteroid[]
) => {
  const width = 164
  const height = 164
  const padding = 12
  const x = viewport.x - width - 18
  const y = 18
  const innerWidth = width - padding * 2
  const innerHeight = height - padding * 2

  context.save()
  context.shadowColor = "rgba(0, 0, 0, 0.72)"
  context.shadowBlur = 18
  context.fillStyle = "rgba(5, 7, 10, 0.82)"
  context.strokeStyle = "rgba(255, 244, 166, 0.72)"
  context.lineWidth = 1.5
  context.beginPath()
  context.roundRect(x, y, width, height, 6)
  context.fill()
  context.stroke()

  context.shadowBlur = 0
  context.strokeStyle = "rgba(255, 244, 166, 0.24)"
  context.strokeRect(x + padding, y + padding, innerWidth, innerHeight)

  context.strokeStyle = "rgba(116, 255, 224, 0.16)"
  context.beginPath()
  context.moveTo(x + padding, y + height / 2)
  context.lineTo(x + width - padding, y + height / 2)
  context.moveTo(x + width / 2, y + padding)
  context.lineTo(x + width / 2, y + height - padding)
  context.stroke()

  players.forEach((player) => {
    const markerX = x + padding + (player.ship.position.x / world.width) * innerWidth
    const markerY = y + padding + (player.ship.position.y / world.height) * innerHeight

    context.fillStyle = player.color
    context.shadowColor = player.color
    context.shadowBlur = 9
    context.beginPath()
    context.arc(markerX, markerY, 4, 0, Math.PI * 2)
    context.fill()
  })

  projectiles.forEach((projectile) => {
    const markerX = x + padding + (projectile.position.x / world.width) * innerWidth
    const markerY = y + padding + (projectile.position.y / world.height) * innerHeight

    context.fillStyle = projectile.color
    context.shadowColor = projectile.color
    context.shadowBlur = 6
    context.beginPath()
    context.arc(markerX, markerY, 2, 0, Math.PI * 2)
    context.fill()
  })

  asteroids.forEach((asteroid) => {
    const markerX = x + padding + (asteroid.position.x / world.width) * innerWidth
    const markerY = y + padding + (asteroid.position.y / world.height) * innerHeight
    const markerRadius = Math.max(1.5, asteroid.radius / 18)

    context.strokeStyle = "rgba(218, 209, 184, 0.72)"
    context.shadowBlur = 0
    context.beginPath()
    context.arc(markerX, markerY, markerRadius, 0, Math.PI * 2)
    context.stroke()
  })

  context.restore()
}

const drawHud = (context: CanvasRenderingContext2D, player: PlayerShip, username: string) => {
  context.fillStyle = "rgba(235, 248, 242, 0.8)"
  context.font = "12px ui-monospace, SFMono-Regular, Menlo, monospace"
  context.fillText(username, 18, 27)
  context.fillStyle = "rgba(116, 255, 224, 0.58)"
  context.fillText(
    `x ${Math.round(player.position.x)}  y ${Math.round(player.position.y)}`,
    18,
    46
  )
}

export const renderGame = ({
  context,
  viewport,
  world,
  localPlayer,
  players,
  projectiles,
  asteroids,
  timeSeconds
}: RenderGameArgs) => {
  context.clearRect(0, 0, viewport.x, viewport.y)

  const gradient = context.createRadialGradient(
    viewport.x / 2,
    viewport.y / 2,
    40,
    viewport.x / 2,
    viewport.y / 2,
    Math.max(viewport.x, viewport.y) * 0.8
  )
  gradient.addColorStop(0, "#102026")
  gradient.addColorStop(1, "#05070a")

  context.fillStyle = gradient
  context.fillRect(0, 0, viewport.x, viewport.y)

  drawGrid(context, localPlayer.ship.position, viewport, world)
  drawBoundary(context, localPlayer.ship.position, viewport, world)
  drawAsteroids(context, localPlayer.ship.position, viewport, asteroids)
  drawProjectiles(context, localPlayer.ship.position, viewport, projectiles)

  players.forEach((player) => {
    const screenPosition = worldToScreen(player.ship.position, localPlayer.ship.position, viewport)

    drawShip(context, screenPosition, player.ship, player.color, player.isThrusting, timeSeconds)
    drawShipLabel(context, screenPosition, player.username, player.color)
  })

  drawMiniMap(context, viewport, world, players, projectiles, asteroids)
  drawHud(context, localPlayer.ship, localPlayer.username)
}
