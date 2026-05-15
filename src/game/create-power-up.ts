import { gameConfig } from "../shared/game-config"
import type { GameWorld, PowerUp, PowerUpType } from "../shared/game-types"
import type { RandomSource } from "./random-source"

const powerUpTypes: PowerUpType[] = ["shield", "scatterShot", "asteroidFreeze", "rapidFire"]

export const createPowerUp = (id: string, world: GameWorld, random: RandomSource): PowerUp => {
  const travelsRight = random() >= 0.5
  const speed =
    gameConfig.powerUpMinSpeed +
    random() * (gameConfig.powerUpMaxSpeed - gameConfig.powerUpMinSpeed)
  const verticalDrift = (random() - 0.5) * speed * 0.35
  const type = powerUpTypes[Math.floor(random() * powerUpTypes.length)] ?? "shield"

  return {
    id,
    type,
    radius: gameConfig.powerUpRadius,
    position: {
      x: travelsRight ? 0 : world.width,
      y: gameConfig.powerUpRadius + random() * (world.height - gameConfig.powerUpRadius * 2)
    },
    velocity: {
      x: travelsRight ? speed : -speed,
      y: verticalDrift
    }
  }
}
