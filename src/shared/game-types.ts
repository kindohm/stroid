export type Vector = {
  x: number
  y: number
}

export type PlayerInput = {
  thrust: boolean
  turnLeft: boolean
  turnRight: boolean
  fire: boolean
}

export type PlayerShip = {
  position: Vector
  velocity: Vector
  angle: number
}

export type GameWorld = {
  width: number
  height: number
}

export type Projectile = {
  id: string
  owner: string
  position: Vector
  velocity: Vector
  color: string
  ttlSeconds: number
}

export type PowerUpType = "shield" | "scatterShot" | "asteroidFreeze"

export type PowerUp = {
  id: string
  type: PowerUpType
  position: Vector
  velocity: Vector
  radius: number
}

export type ActivePowerUpEffect = {
  playerId: string
  type: PowerUpType
  expiresAt: number
}

export type AsteroidSize = "small" | "medium" | "large" | "extraLarge"

export type Asteroid = {
  id: string
  name?: string
  position: Vector
  velocity: Vector
  size: AsteroidSize
  radius: number
  shape: number[]
}
