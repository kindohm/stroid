import { describe, expect, it } from "vitest"
import type { LifeState } from "../../../shared/lobby-types"
import { getGhostMarkers } from "./get-ghost-markers"

describe("getGhostMarkers", () => {
  it("returns render markers only for eliminated players with ghost positions", () => {
    const lives: LifeState = {
      players: [
        {
          id: "alpha",
          username: "Alpha",
          color: "#f00",
          lives: 0,
          isEliminated: true,
          ghostPosition: { x: 12, y: 34 }
        },
        {
          id: "beta",
          username: "Beta",
          color: "#0f0",
          lives: 0,
          isEliminated: true
        }
      ]
    }

    expect(getGhostMarkers(lives)).toEqual([
      {
        username: "Alpha",
        color: "#f00",
        position: { x: 12, y: 34 }
      }
    ])
  })
})
