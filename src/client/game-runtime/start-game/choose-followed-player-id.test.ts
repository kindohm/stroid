import { describe, expect, it } from "vitest"
import type { LifeState, LobbyPlayer } from "../../../shared/lobby-types"
import { chooseFollowedPlayerId } from "./choose-followed-player-id"

const players: LobbyPlayer[] = [
  { id: "self", username: "Self", color: "#fff" },
  { id: "alpha", username: "Alpha", color: "#f00" },
  { id: "beta", username: "Beta", color: "#0f0" }
]

const lives: LifeState = {
  players: [
    { ...players[0], lives: 1, isEliminated: false },
    { ...players[1], lives: 0, isEliminated: true },
    { ...players[2], lives: 1, isEliminated: false }
  ]
}

describe("chooseFollowedPlayerId", () => {
  it("keeps the followed player when they are still alive", () => {
    expect(chooseFollowedPlayerId({ followedPlayerId: "beta", lives, players, selfId: "self" })).toBe("beta")
  })

  it("skips eliminated players when choosing a new player", () => {
    expect(chooseFollowedPlayerId({ followedPlayerId: "alpha", lives, players, selfId: "self" })).toBe("beta")
  })
})
