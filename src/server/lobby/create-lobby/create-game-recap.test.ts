import { describe, expect, it } from "vitest"
import type { GameRecapEvent, LobbyPlayer } from "../../../shared/lobby-types"
import { createGameRecap } from "./create-game-recap"

const player: LobbyPlayer = {
  id: "mike",
  username: "mike",
  color: "#74ffe0"
}

describe("createGameRecap", () => {
  it("finds first hit, final asteroid, biggest streak, and final ten seconds", () => {
    const events: GameRecapEvent[] = [
      { type: "gameStarted", elapsedSeconds: 0, label: "room launched" },
      {
        type: "asteroidDestroyed",
        elapsedSeconds: 2,
        player,
        asteroidName: "Larry",
        asteroidSize: "large",
        scoreDelta: 100
      },
      {
        type: "asteroidDestroyed",
        elapsedSeconds: 4,
        player,
        asteroidName: "Miriam",
        asteroidSize: "medium",
        scoreDelta: 200
      },
      {
        type: "playerDestroyed",
        elapsedSeconds: 8,
        player,
        cause: "asteroid",
        livesRemaining: 2
      },
      { type: "gameOver", elapsedSeconds: 14, label: "all ships lost" }
    ]

    const recap = createGameRecap({ events, elapsedSeconds: 20 })

    expect(recap.highlights.firstPlayerHit).toEqual(expect.objectContaining({ type: "playerDestroyed" }))
    expect(recap.highlights.finalAsteroidDestroyed).toEqual(expect.objectContaining({ asteroidName: "Miriam" }))
    expect(recap.highlights.biggestScoreStreak).toEqual(expect.objectContaining({
      score: 300,
      asteroidCount: 2
    }))
    expect(recap.highlights.finalTenSeconds.map((event) => event.type)).toEqual([
      "asteroidDestroyed",
      "playerDestroyed",
      "gameOver"
    ])
  })
})
