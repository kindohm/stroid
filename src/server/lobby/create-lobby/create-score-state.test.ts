import { describe, expect, it } from "vitest"
import type { LobbyPlayer } from "../../../shared/lobby-types"
import { createScoreState } from "./create-score-state"

const players: LobbyPlayer[] = [
  {
    id: "mike",
    username: "mike",
    color: "#74ffe0"
  },
  {
    id: "zoe",
    username: "zoe",
    color: "#fff4a6"
  }
]

describe("createScoreState", () => {
  it("sorts players by score and calculates team score", () => {
    const scoresByClientId = new Map([
      ["zoe", 300],
      ["mike", 100]
    ])

    expect(createScoreState(players, scoresByClientId)).toEqual({
      teamScore: 400,
      players: [
        expect.objectContaining({ username: "zoe", score: 300 }),
        expect.objectContaining({ username: "mike", score: 100 })
      ]
    })
  })

  it("sorts tied scores by username", () => {
    expect(createScoreState(players, new Map()).players.map((player) => player.username)).toEqual(["mike", "zoe"])
  })
})
