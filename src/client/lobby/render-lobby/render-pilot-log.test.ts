import { describe, expect, it } from "vitest"
import { createDefaultPlayerStats } from "../../../shared/player-stats"
import { getPilotStyle } from "./render-pilot-log"

describe("renderPilotLog", () => {
  it("derives a fresh style when no games exist", () => {
    expect(getPilotStyle(createDefaultPlayerStats())).toBe("fresh signal")
  })

  it("derives patient deadeye for high contact rate", () => {
    expect(getPilotStyle({
      ...createDefaultPlayerStats(),
      gamesPlayed: 4,
      shotsFired: 100,
      asteroidsHit: 50
    })).toBe("patient deadeye")
  })
})
