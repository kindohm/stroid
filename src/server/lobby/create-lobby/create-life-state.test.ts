import { describe, expect, it } from "vitest"
import type { LobbyPlayer } from "../../../shared/lobby-types"
import { createLifeState } from "./create-life-state"

const player: LobbyPlayer = {
  id: "mike",
  username: "mike",
  color: "#74ffe0"
}

describe("createLifeState", () => {
  it("uses starting lives when player has no stored life value", () => {
    expect(createLifeState([player], new Map(), 3).players[0]).toEqual({
      ...player,
      lives: 3,
      isEliminated: false
    })
  })

  it("marks players with zero lives as eliminated", () => {
    expect(createLifeState([player], new Map([["mike", 0]]), 3).players[0]).toEqual({
      ...player,
      lives: 0,
      isEliminated: true
    })
  })

  it("adds ghost position only for eliminated players", () => {
    const ghostPosition = { x: 120, y: 140 }

    expect(createLifeState(
      [player],
      new Map([["mike", 0]]),
      3,
      new Map([["mike", ghostPosition]])
    ).players[0]).toEqual({
      ...player,
      lives: 0,
      isEliminated: true,
      ghostPosition
    })

    expect(createLifeState(
      [player],
      new Map([["mike", 1]]),
      3,
      new Map([["mike", ghostPosition]])
    ).players[0].ghostPosition).toBeUndefined()
  })
})
