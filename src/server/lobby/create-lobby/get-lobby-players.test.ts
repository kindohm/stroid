import { describe, expect, it } from "vitest"
import { getLobbyPlayers } from "./get-lobby-players"

describe("getLobbyPlayers", () => {
  it("returns named clients with assigned colors", () => {
    const players = getLobbyPlayers(new Map([
      ["mike", { id: "mike", username: "mike", socket: {} as never }],
      ["blank", { id: "blank", username: "", socket: {} as never }]
    ]))

    expect(players).toEqual([{
      id: "mike",
      username: "mike",
      color: expect.any(String)
    }])
  })
})
