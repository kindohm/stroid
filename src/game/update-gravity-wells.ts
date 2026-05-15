import type { GameWorld, GravityWell } from "../shared/game-types"

const isInsideTravelBounds = (gravityWell: GravityWell, world: GameWorld) =>
  gravityWell.position.x >= -gravityWell.influenceRadius &&
  gravityWell.position.x <= world.width + gravityWell.influenceRadius &&
  gravityWell.position.y >= -gravityWell.influenceRadius &&
  gravityWell.position.y <= world.height + gravityWell.influenceRadius

export const updateGravityWells = (
  gravityWells: GravityWell[],
  deltaSeconds: number,
  world: GameWorld
): GravityWell[] =>
  gravityWells
    .map((gravityWell) => ({
      ...gravityWell,
      position: {
        x: gravityWell.position.x + gravityWell.velocity.x * deltaSeconds,
        y: gravityWell.position.y + gravityWell.velocity.y * deltaSeconds
      }
    }))
    .filter((gravityWell) => isInsideTravelBounds(gravityWell, world))
