import { describe, expect, it } from "vitest"
import { parseClientMessage } from "./parse-client-message"

describe("parseClientMessage", () => {
  it("parses powerup hit messages", () => {
    expect(parseClientMessage(Buffer.from(JSON.stringify({
      type: "powerUpHit",
      powerUpId: "power-up-1"
    })))).toEqual({
      type: "powerUpHit",
      powerUpId: "power-up-1"
    })
  })
})
