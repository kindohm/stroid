import { describe, expect, it } from "vitest"
import type { Asteroid } from "../../../shared/game-types"
import type { LobbyPlayer } from "../../../shared/lobby-types"
import { createAsteroidStatsTracker } from "./create-asteroid-stats-tracker"

const player: LobbyPlayer = {
  id: "mike",
  username: "mike",
  color: "#74ffe0"
}

const asteroid: Asteroid = {
  id: "asteroid-1",
  name: "Larry",
  position: { x: 0, y: 0 },
  velocity: { x: 0, y: 0 },
  size: "large",
  radius: 54,
  shape: [1, 1]
}

describe("createAsteroidStatsTracker", () => {
  it("records destroyed asteroid counts by size and name", () => {
    const tracker = createAsteroidStatsTracker()

    tracker.createForPlayers([player])
    tracker.recordDestroyed(player, asteroid)

    const stats = tracker.getState([player]).players[0]

    expect(stats.destroyedBySize.large).toBe(1)
    expect(stats.destroyedNamesBySize.large.Larry).toBe(1)
  })

  it("creates empty stats for players without records", () => {
    const tracker = createAsteroidStatsTracker()
    const stats = tracker.getState([player]).players[0]

    expect(stats.destroyedBySize).toEqual({
      extraLarge: 0,
      large: 0,
      medium: 0,
      small: 0
    })
  })
})
