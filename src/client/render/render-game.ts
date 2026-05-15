import { gameConfig } from "../../shared/game-config"
import type { Asteroid, BossAsteroid, GameWorld, PlayerShip, PowerUp, PowerUpType, Projectile, Vector } from "../../shared/game-types"

export type RenderPlayerView = {
  username: string
  ship: PlayerShip
  color: string
  isThrusting: boolean
  isLocal?: boolean
  isInvincible?: boolean
  isHidden?: boolean
}

export type RenderExplosion = {
  position: Vector
  color: string
  ageSeconds: number
}

export type RenderGhostMarker = {
  username: string
  position: Vector
  color: string
}

type RenderGameArgs = {
  context: CanvasRenderingContext2D
  viewport: Vector
  world: GameWorld
  localPlayer: RenderPlayerView
  players: RenderPlayerView[]
  projectiles: Projectile[]
  asteroids: Asteroid[]
  boss?: BossAsteroid
  bossCountdown?: {
    preSpawnActive: boolean
    nextBossWindowAt: number
    intervalMs: number
    now: number
  }
  powerUps?: PowerUp[]
  ghostMarkers?: RenderGhostMarker[]
  explosions: RenderExplosion[]
  isSpectator?: boolean
  timeSeconds: number
}

let backgroundGradient:
  | {
      width: number
      height: number
      value: CanvasGradient
    }
  | undefined

const worldToScreen = (point: Vector, camera: Vector, viewport: Vector): Vector => ({
  x: point.x - camera.x + viewport.x / 2,
  y: point.y - camera.y + viewport.y / 2
})

const isOnScreen = (screenPosition: Vector, viewport: Vector, margin: number) =>
  screenPosition.x >= -margin &&
  screenPosition.x <= viewport.x + margin &&
  screenPosition.y >= -margin &&
  screenPosition.y <= viewport.y + margin

const getBackgroundGradient = (
  context: CanvasRenderingContext2D,
  viewport: Vector
): CanvasGradient => {
  if (backgroundGradient?.width === viewport.x && backgroundGradient.height === viewport.y) {
    return backgroundGradient.value
  }

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
  backgroundGradient = {
    width: viewport.x,
    height: viewport.y,
    value: gradient
  }

  return gradient
}

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
  timeSeconds: number,
  isLocal = false
) => {
  context.save()
  context.translate(screenPosition.x, screenPosition.y)
  context.rotate(player.angle)

  if (player && isLocal) {
    context.globalAlpha = 1
  }

  if (isLocal && isThrusting) {
    drawThrust(context, timeSeconds)
  }

  context.strokeStyle = color
  context.fillStyle = "rgba(12, 22, 28, 0.92)"
  context.lineWidth = isLocal ? 2 : 1.5

  if (isLocal) {
    context.shadowColor = color
    context.shadowBlur = 14
  }

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

const drawGhostBubble = (
  context: CanvasRenderingContext2D,
  screenPosition: Vector,
  color: string,
  timeSeconds: number
) => {
  const pulse = Math.sin(timeSeconds * 8) * 3

  context.save()
  context.globalAlpha = 0.72
  context.strokeStyle = color
  context.fillStyle = "rgba(236, 248, 241, 0.06)"
  context.lineWidth = 1.5
  context.shadowColor = color
  context.shadowBlur = 16
  context.beginPath()
  context.arc(screenPosition.x, screenPosition.y, gameConfig.shipRadius + 14 + pulse, 0, Math.PI * 2)
  context.fill()
  context.stroke()
  context.restore()
}

const drawGhostMarkers = (
  context: CanvasRenderingContext2D,
  camera: Vector,
  viewport: Vector,
  ghostMarkers: RenderGhostMarker[],
  timeSeconds: number
) => {
  ghostMarkers.forEach((marker) => {
    const screenPosition = worldToScreen(marker.position, camera, viewport)

    if (!isOnScreen(screenPosition, viewport, 80)) {
      return
    }

    const pulse = Math.sin(timeSeconds * 5) * 5

    context.save()
    context.globalAlpha = 0.78
    context.strokeStyle = marker.color
    context.fillStyle = "rgba(236, 248, 241, 0.05)"
    context.lineWidth = 2
    context.shadowColor = marker.color
    context.shadowBlur = 22
    context.beginPath()
    context.arc(screenPosition.x, screenPosition.y, gameConfig.shipRadius + 24 + pulse, 0, Math.PI * 2)
    context.fill()
    context.stroke()
    context.beginPath()
    context.moveTo(screenPosition.x - 16, screenPosition.y)
    context.lineTo(screenPosition.x + 16, screenPosition.y)
    context.moveTo(screenPosition.x, screenPosition.y - 16)
    context.lineTo(screenPosition.x, screenPosition.y + 16)
    context.stroke()
    context.restore()

    drawShipLabel(context, {
      x: screenPosition.x,
      y: screenPosition.y - 8
    }, `revive ${marker.username}`, marker.color)
  })
}

const drawExplosions = (
  context: CanvasRenderingContext2D,
  camera: Vector,
  viewport: Vector,
  explosions: RenderExplosion[]
) => {
  explosions.forEach((explosion) => {
    const screenPosition = worldToScreen(explosion.position, camera, viewport)
    const progress = Math.min(1, explosion.ageSeconds / 0.8)
    const alpha = 1 - progress

    context.save()
    context.globalAlpha = alpha
    context.strokeStyle = explosion.color
    context.fillStyle = "rgba(255, 244, 166, 0.18)"
    context.lineWidth = 2
    context.shadowColor = explosion.color
    context.shadowBlur = 20

    for (let index = 0; index < 3; index += 1) {
      context.beginPath()
      context.arc(screenPosition.x, screenPosition.y, 10 + progress * (28 + index * 14), 0, Math.PI * 2)
      context.stroke()
    }

    context.beginPath()
    context.arc(screenPosition.x, screenPosition.y, 5 + progress * 10, 0, Math.PI * 2)
    context.fill()
    context.restore()
  })
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

    if (!isOnScreen(screenPosition, viewport, gameConfig.projectileRadius + 12)) {
      return
    }

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

    if (!isOnScreen(screenPosition, viewport, asteroid.radius + 24)) {
      return
    }

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

    if (asteroid.name) {
      context.save()
      context.font = "11px ui-monospace, SFMono-Regular, Menlo, monospace"
      context.textAlign = "center"
      context.textBaseline = "middle"
      context.fillStyle = "rgba(5, 7, 10, 0.78)"
      context.strokeStyle = "rgba(218, 209, 184, 0.66)"
      context.lineWidth = 1

      const labelWidth = Math.max(44, context.measureText(asteroid.name).width + 16)
      const labelY = screenPosition.y - asteroid.radius - 18

      context.beginPath()
      context.roundRect(screenPosition.x - labelWidth / 2, labelY - 10, labelWidth, 20, 4)
      context.fill()
      context.stroke()
      context.fillStyle = "rgba(236, 248, 241, 0.84)"
      context.fillText(asteroid.name, screenPosition.x, labelY + 1)
      context.restore()
    }
  })
}

const drawBoss = (
  context: CanvasRenderingContext2D,
  camera: Vector,
  viewport: Vector,
  boss: BossAsteroid,
  timeSeconds: number
) => {
  const screenPosition = worldToScreen(boss.position, camera, viewport)

  if (!isOnScreen(screenPosition, viewport, boss.radius + 42)) {
    return
  }

  const step = (Math.PI * 2) / boss.shape.length
  const pulse = Math.sin(timeSeconds * 2.4) * 0.04

  context.save()
  context.translate(screenPosition.x, screenPosition.y)
  context.rotate(timeSeconds * 0.08)
  context.strokeStyle = "rgba(255, 244, 166, 0.96)"
  context.fillStyle = "rgba(92, 54, 42, 0.72)"
  context.lineWidth = 4
  context.shadowColor = "rgba(255, 244, 166, 0.32)"
  context.shadowBlur = 26
  context.beginPath()

  boss.shape.forEach((scale, index) => {
    const angle = step * index
    const radius = boss.radius * (scale + pulse)
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

  context.save()
  context.font = "16px ui-monospace, SFMono-Regular, Menlo, monospace"
  context.textAlign = "center"
  context.textBaseline = "middle"
  context.fillStyle = "rgba(5, 7, 10, 0.82)"
  context.strokeStyle = "rgba(255, 244, 166, 0.82)"
  context.lineWidth = 1.5

  const labelWidth = Math.max(80, context.measureText(boss.name).width + 24)
  const labelY = screenPosition.y - boss.radius - 24

  context.beginPath()
  context.roundRect(screenPosition.x - labelWidth / 2, labelY - 13, labelWidth, 26, 5)
  context.fill()
  context.stroke()
  context.fillStyle = "rgba(255, 252, 232, 0.94)"
  context.fillText(boss.name, screenPosition.x, labelY + 1)
  context.restore()
}

const powerUpColorByType: Record<PowerUpType, string> = {
  shield: "#74ffe0",
  scatterShot: "#fff4a6",
  asteroidFreeze: "#9bb7ff"
}

const drawPowerUpShape = (
  context: CanvasRenderingContext2D,
  type: PowerUpType,
  radius: number,
  timeSeconds: number
) => {
  const pulse = Math.sin(timeSeconds * 8) * 2

  if (type === "shield") {
    context.beginPath()
    context.arc(0, 0, radius + pulse, 0, Math.PI * 2)
    context.stroke()
    context.beginPath()
    context.arc(0, 0, radius * 0.54, 0, Math.PI * 2)
    context.stroke()
    return
  }

  if (type === "scatterShot") {
    const shotAngles = [-0.58, 0, 0.58]

    shotAngles.forEach((angle) => {
      context.beginPath()
      context.moveTo(Math.cos(angle) * -radius * 0.35, Math.sin(angle) * -radius * 0.35)
      context.lineTo(Math.cos(angle) * (radius + pulse), Math.sin(angle) * (radius + pulse))
      context.stroke()
    })
    return
  }

  context.beginPath()
  context.moveTo(0, -radius - pulse)
  context.lineTo(radius * 0.72, -radius * 0.16)
  context.lineTo(radius * 0.42, radius * 0.82)
  context.lineTo(-radius * 0.42, radius * 0.82)
  context.lineTo(-radius * 0.72, -radius * 0.16)
  context.closePath()
  context.stroke()
}

const drawPowerUps = (
  context: CanvasRenderingContext2D,
  camera: Vector,
  viewport: Vector,
  powerUps: PowerUp[],
  timeSeconds: number
) => {
  powerUps.forEach((powerUp) => {
    const screenPosition = worldToScreen(powerUp.position, camera, viewport)

    if (!isOnScreen(screenPosition, viewport, powerUp.radius + 24)) {
      return
    }

    const color = powerUpColorByType[powerUp.type]

    context.save()
    context.translate(screenPosition.x, screenPosition.y)
    context.rotate(timeSeconds * 1.8)
    context.strokeStyle = color
    context.fillStyle = "rgba(5, 7, 10, 0.58)"
    context.lineWidth = 2
    context.shadowColor = color
    context.shadowBlur = 18
    context.beginPath()
    context.arc(0, 0, powerUp.radius + 7, 0, Math.PI * 2)
    context.fill()
    context.stroke()
    drawPowerUpShape(context, powerUp.type, powerUp.radius, timeSeconds)
    context.restore()
  })
}

const drawMiniMap = (
  context: CanvasRenderingContext2D,
  viewport: Vector,
  world: GameWorld,
  players: RenderPlayerView[],
  projectiles: Projectile[],
  asteroids: Asteroid[],
  boss: BossAsteroid | undefined,
  powerUps: PowerUp[],
  ghostMarkers: RenderGhostMarker[]
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
    context.shadowBlur = 0
    context.beginPath()
    context.arc(markerX, markerY, 4, 0, Math.PI * 2)
    context.fill()
  })

  projectiles.forEach((projectile) => {
    const markerX = x + padding + (projectile.position.x / world.width) * innerWidth
    const markerY = y + padding + (projectile.position.y / world.height) * innerHeight

    context.fillStyle = projectile.color
    context.shadowBlur = 0
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

  if (boss) {
    const markerX = x + padding + (boss.position.x / world.width) * innerWidth
    const markerY = y + padding + (boss.position.y / world.height) * innerHeight

    context.strokeStyle = "rgba(255, 244, 166, 0.92)"
    context.shadowBlur = 0
    context.beginPath()
    context.arc(markerX, markerY, 10, 0, Math.PI * 2)
    context.stroke()
  }

  powerUps.forEach((powerUp) => {
    const markerX = x + padding + (powerUp.position.x / world.width) * innerWidth
    const markerY = y + padding + (powerUp.position.y / world.height) * innerHeight

    context.fillStyle = powerUpColorByType[powerUp.type]
    context.shadowBlur = 0
    context.beginPath()
    context.arc(markerX, markerY, 3, 0, Math.PI * 2)
    context.fill()
  })

  ghostMarkers.forEach((marker) => {
    const markerX = x + padding + (marker.position.x / world.width) * innerWidth
    const markerY = y + padding + (marker.position.y / world.height) * innerHeight

    context.strokeStyle = marker.color
    context.shadowBlur = 0
    context.beginPath()
    context.arc(markerX, markerY, 6, 0, Math.PI * 2)
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

const drawSpectatorBanner = (context: CanvasRenderingContext2D, viewport: Vector, timeSeconds: number) => {
  const pulse = 0.62 + Math.sin(timeSeconds * 4) * 0.22
  const scanX = ((timeSeconds * 90) % (viewport.x + 260)) - 130

  context.save()
  context.globalAlpha = pulse
  context.fillStyle = "rgba(5, 7, 10, 0.68)"
  context.strokeStyle = "rgba(255, 244, 166, 0.72)"
  context.lineWidth = 1.5
  context.beginPath()
  context.roundRect(Math.max(18, viewport.x / 2 - 172), 72, Math.min(344, viewport.x - 36), 34, 6)
  context.fill()
  context.stroke()

  context.globalAlpha = 0.24
  context.strokeStyle = "rgba(116, 255, 224, 0.86)"
  context.beginPath()
  context.moveTo(scanX, 72)
  context.lineTo(scanX + 110, 106)
  context.stroke()

  context.globalAlpha = 1
  context.fillStyle = "rgba(255, 244, 166, 0.94)"
  context.font = "800 13px ui-monospace, SFMono-Regular, Menlo, monospace"
  context.textAlign = "center"
  context.textBaseline = "middle"
  context.fillText("SPECTATOR MODE", viewport.x / 2, 90)
  context.restore()
}

const drawBossHealth = (context: CanvasRenderingContext2D, viewport: Vector, boss: BossAsteroid) => {
  const width = Math.min(420, viewport.x - 36)
  const height = 18
  const x = (viewport.x - width) / 2
  const y = 24
  const healthRatio = boss.maxHealth > 0 ? boss.health / boss.maxHealth : 0

  context.save()
  context.fillStyle = "rgba(5, 7, 10, 0.82)"
  context.strokeStyle = "rgba(255, 244, 166, 0.74)"
  context.lineWidth = 1.5
  context.shadowColor = "rgba(0, 0, 0, 0.58)"
  context.shadowBlur = 14
  context.beginPath()
  context.roundRect(x, y, width, height, 5)
  context.fill()
  context.stroke()
  context.shadowBlur = 0
  context.fillStyle = "rgba(255, 244, 166, 0.86)"
  context.fillRect(x + 3, y + 3, Math.max(0, (width - 6) * healthRatio), height - 6)
  context.font = "11px ui-monospace, SFMono-Regular, Menlo, monospace"
  context.textAlign = "center"
  context.textBaseline = "middle"
  context.fillStyle = "rgba(255, 252, 232, 0.96)"
  context.fillText(`${boss.name} ${boss.health}/${boss.maxHealth}`, viewport.x / 2, y + height + 13)
  context.restore()
}

const drawBossCountdown = (
  context: CanvasRenderingContext2D,
  viewport: Vector,
  bossCountdown: NonNullable<RenderGameArgs["bossCountdown"]>
) => {
  const width = Math.min(320, viewport.x - 36)
  const height = 10
  const x = (viewport.x - width) / 2
  const y = 24
  const remainingMs = Math.max(0, bossCountdown.nextBossWindowAt - bossCountdown.now)
  const ratio = bossCountdown.preSpawnActive
    ? 1
    : Math.min(1, remainingMs / Math.max(1, bossCountdown.intervalMs))
  const label = bossCountdown.preSpawnActive
    ? "boss window: clear asteroids"
    : `boss window ${Math.ceil(remainingMs / 1000)}s`

  context.save()
  context.fillStyle = "rgba(5, 7, 10, 0.72)"
  context.strokeStyle = "rgba(116, 255, 224, 0.38)"
  context.lineWidth = 1
  context.beginPath()
  context.roundRect(x, y, width, height, 4)
  context.fill()
  context.stroke()
  context.fillStyle = bossCountdown.preSpawnActive
    ? "rgba(255, 244, 166, 0.82)"
    : "rgba(116, 255, 224, 0.72)"
  context.fillRect(x + 2, y + 2, Math.max(0, (width - 4) * ratio), height - 4)
  context.font = "11px ui-monospace, SFMono-Regular, Menlo, monospace"
  context.textAlign = "center"
  context.textBaseline = "middle"
  context.fillStyle = "rgba(236, 248, 241, 0.82)"
  context.fillText(label, viewport.x / 2, y + height + 12)
  context.restore()
}

export const renderGame = ({
  context,
  viewport,
  world,
  localPlayer,
  players,
  projectiles,
  asteroids,
  boss,
  bossCountdown,
  powerUps = [],
  ghostMarkers = [],
  explosions,
  isSpectator = false,
  timeSeconds
}: RenderGameArgs) => {
  context.clearRect(0, 0, viewport.x, viewport.y)

  context.fillStyle = getBackgroundGradient(context, viewport)
  context.fillRect(0, 0, viewport.x, viewport.y)

  drawGrid(context, localPlayer.ship.position, viewport, world)
  drawBoundary(context, localPlayer.ship.position, viewport, world)
  drawAsteroids(context, localPlayer.ship.position, viewport, asteroids)
  if (boss) {
    drawBoss(context, localPlayer.ship.position, viewport, boss, timeSeconds)
  }
  drawPowerUps(context, localPlayer.ship.position, viewport, powerUps, timeSeconds)
  drawGhostMarkers(context, localPlayer.ship.position, viewport, ghostMarkers, timeSeconds)
  drawProjectiles(context, localPlayer.ship.position, viewport, projectiles)
  drawExplosions(context, localPlayer.ship.position, viewport, explosions)

  const hasMarkedLocalPlayer = players.some((player) => player.isLocal)
  const remotePlayers = hasMarkedLocalPlayer
    ? players.filter((player) => !player.isLocal)
    : players.filter((player) => player !== localPlayer)

  remotePlayers.forEach((player) => {
    const screenPosition = worldToScreen(player.ship.position, localPlayer.ship.position, viewport)

    if (!isOnScreen(screenPosition, viewport, gameConfig.shipRadius + 70)) {
      return
    }

    if (player.isInvincible) {
      drawGhostBubble(context, screenPosition, player.color, timeSeconds)
    }

    drawShip(context, screenPosition, player.ship, player.color, false, timeSeconds)
    drawShipLabel(context, screenPosition, player.username, player.color)
  })

  const localScreenPosition = worldToScreen(
    localPlayer.ship.position,
    localPlayer.ship.position,
    viewport
  )

  if (!localPlayer.isHidden) {
    if (localPlayer.isInvincible) {
      drawGhostBubble(context, localScreenPosition, localPlayer.color, timeSeconds)
    }

    drawShip(
      context,
      localScreenPosition,
      localPlayer.ship,
      localPlayer.color,
      localPlayer.isThrusting,
      timeSeconds,
      true
    )
    drawShipLabel(context, localScreenPosition, localPlayer.username, localPlayer.color)
  }

  drawMiniMap(context, viewport, world, players, projectiles, asteroids, boss, powerUps, ghostMarkers)
  drawHud(context, localPlayer.ship, localPlayer.username)
  if (isSpectator) {
    drawSpectatorBanner(context, viewport, timeSeconds)
  }
  if (boss) {
    drawBossHealth(context, viewport, boss)
  } else if (bossCountdown) {
    drawBossCountdown(context, viewport, bossCountdown)
  }
}
