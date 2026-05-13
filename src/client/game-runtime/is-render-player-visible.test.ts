import { describe, expect, it } from "vitest"
import type { LifeState, LobbyPlayer } from "../../shared/lobby-types"
import { isRenderPlayerVisible } from "./is-render-player-visible"

const player: LobbyPlayer = {
  id: "player-1",
  username: "zoe",
  color: "#ff7a90"
}

const lives: LifeState = {
  players: [
    {
      ...player,
      lives: 2,
      isEliminated: false
    }
  ]
}

describe("isRenderPlayerVisible", () => {
  it("hides remote players marked hidden after destruction", () => {
    expect(isRenderPlayerVisible(player, "self", "alive", lives, new Set(["player-1"]))).toBe(false)
  })

  it("shows remote players once they are no longer hidden", () => {
    expect(isRenderPlayerVisible(player, "self", "alive", lives, new Set())).toBe(true)
  })

  it("hides local player while destroyed", () => {
    expect(isRenderPlayerVisible(player, "player-1", "destroyed", lives, new Set())).toBe(false)
  })
})
