import type { GameWorld, GravityWell, PowerUp } from "../shared/game-types"
import { applyGravityWells } from "./apply-gravity-wells"

const isInsidePowerUpTravel = (powerUp: PowerUp, world: GameWorld) =>
  powerUp.position.x >= -powerUp.radius &&
  powerUp.position.x <= world.width + powerUp.radius &&
  powerUp.position.y >= -powerUp.radius &&
  powerUp.position.y <= world.height + powerUp.radius

export const updatePowerUps = (
  powerUps: PowerUp[],
  deltaSeconds: number,
  world: GameWorld,
  gravityWells: GravityWell[] = []
): PowerUp[] =>
  powerUps
    .map((powerUp) => {
      const velocity = applyGravityWells(powerUp.velocity, powerUp.position, gravityWells, deltaSeconds)

      return {
        ...powerUp,
        velocity,
        position: {
          x: powerUp.position.x + velocity.x * deltaSeconds,
          y: powerUp.position.y + velocity.y * deltaSeconds
        }
      }
    })
    .filter((powerUp) => isInsidePowerUpTravel(powerUp, world))
