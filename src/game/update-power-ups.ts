import type { GameWorld, PowerUp } from "../shared/game-types"

const isInsidePowerUpTravel = (powerUp: PowerUp, world: GameWorld) =>
  powerUp.position.x >= -powerUp.radius &&
  powerUp.position.x <= world.width + powerUp.radius &&
  powerUp.position.y >= -powerUp.radius &&
  powerUp.position.y <= world.height + powerUp.radius

export const updatePowerUps = (
  powerUps: PowerUp[],
  deltaSeconds: number,
  world: GameWorld
): PowerUp[] =>
  powerUps
    .map((powerUp) => ({
      ...powerUp,
      position: {
        x: powerUp.position.x + powerUp.velocity.x * deltaSeconds,
        y: powerUp.position.y + powerUp.velocity.y * deltaSeconds
      }
    }))
    .filter((powerUp) => isInsidePowerUpTravel(powerUp, world))
