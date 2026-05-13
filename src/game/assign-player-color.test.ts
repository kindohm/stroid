import { describe, expect, it } from "vitest"
import { assignPlayerColor } from "./assign-player-color"

describe("assignPlayerColor", () => {
  it("assigns a stable palette color by username", () => {
    expect(assignPlayerColor("mike")).toBe(assignPlayerColor("mike"))
  })

  it("uses different palette colors for different names when hashes differ", () => {
    expect(assignPlayerColor("mike")).not.toBe(assignPlayerColor("zoe"))
  })
})
