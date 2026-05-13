import { describe, expect, it } from "vitest"
import { createStartingPlayerShip } from "./create-starting-player-ship"

describe("createStartingPlayerShip", () => {
  it("places players at different starting positions", () => {
    const first = createStartingPlayerShip(0, 2)
    const second = createStartingPlayerShip(1, 2)

    expect(first.position).not.toEqual(second.position)
  })
})
