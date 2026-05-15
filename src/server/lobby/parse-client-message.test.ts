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

  it("sanitizes room settings messages", () => {
    expect(parseClientMessage(Buffer.from(JSON.stringify({
      type: "setRoomSettings",
      settings: {
        mapSize: "tiny",
        asteroidDensity: 2,
        playerLives: 4,
        friendlyFire: true,
        maxShipSpeed: 1200,
        bossIntervalMinutes: 2,
        bossHealthPerPlayer: 200
      }
    })))).toEqual({
      type: "setRoomSettings",
      settings: {
        mapSize: "tiny",
        asteroidDensity: 1,
        playerLives: 4,
        friendlyFire: true,
        maxShipSpeed: 1200,
        bossIntervalMinutes: 2,
        bossHealthPerPlayer: 100
      }
    })
  })

  it("parses ready toggle messages", () => {
    expect(parseClientMessage(Buffer.from(JSON.stringify({
      type: "setReady",
      isReady: true
    })))).toEqual({
      type: "setReady",
      isReady: true
    })
  })

  it("parses boss hit messages", () => {
    expect(parseClientMessage(Buffer.from(JSON.stringify({
      type: "bossHit",
      bossId: "boss-1"
    })))).toEqual({
      type: "bossHit",
      bossId: "boss-1"
    })
  })

  it("parses revive player messages", () => {
    expect(parseClientMessage(Buffer.from(JSON.stringify({
      type: "revivePlayer",
      playerId: "player-1"
    })))).toEqual({
      type: "revivePlayer",
      playerId: "player-1"
    })
  })
})
