import { gameConfig } from "../shared/game-config"
import type { GameWorld, PlayerInput, PlayerShip, Vector } from "../shared/game-types"

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

const bounceVelocity = (velocity: number, nextPosition: number, position: number) => {
  if (position !== nextPosition) {
    return -velocity * gameConfig.wallBounceVelocityRetained
  }

  return velocity
}

const clampToSpeed = (velocity: Vector, maxSpeed: number): Vector => {
  const speed = Math.hypot(velocity.x, velocity.y)

  if (speed <= maxSpeed) {
    return velocity
  }

  const scale = maxSpeed / speed

  return {
    x: velocity.x * scale,
    y: velocity.y * scale
  }
}

export const updatePlayer = (
  player: PlayerShip,
  input: PlayerInput,
  deltaSeconds: number,
  world: GameWorld,
  maxSpeed: number = gameConfig.maxSpeed
): PlayerShip => {
  const turn = Number(input.turnRight) - Number(input.turnLeft)
  const angle = player.angle + turn * gameConfig.turnSpeed * deltaSeconds
  const thrust = input.thrust ? gameConfig.thrustAcceleration : 0
  const acceleratedVelocity = {
    x: player.velocity.x + Math.cos(angle) * thrust * deltaSeconds,
    y: player.velocity.y + Math.sin(angle) * thrust * deltaSeconds
  }
  const drag = Math.max(0, 1 - gameConfig.dragPerSecond * deltaSeconds)
  const velocity = clampToSpeed(
    {
      x: acceleratedVelocity.x * drag,
      y: acceleratedVelocity.y * drag
    },
    maxSpeed
  )
  const nextPosition = {
    x: player.position.x + velocity.x * deltaSeconds,
    y: player.position.y + velocity.y * deltaSeconds
  }
  const radius = gameConfig.shipRadius
  const position = {
    x: clamp(nextPosition.x, radius, world.width - radius),
    y: clamp(nextPosition.y, radius, world.height - radius)
  }

  return {
    position,
    velocity: {
      x: bounceVelocity(velocity.x, nextPosition.x, position.x),
      y: bounceVelocity(velocity.y, nextPosition.y, position.y)
    },
    angle
  }
}
