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

export type AsteroidSize = "small" | "medium" | "large" | "extraLarge"

export type Asteroid = {
  id: string
  position: Vector
  velocity: Vector
  size: AsteroidSize
  radius: number
  shape: number[]
}
