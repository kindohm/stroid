import { describe, expect, it } from "vitest"
import { defaultRoomSettings } from "../../shared/room-settings"
import { parseServerMessage } from "./create-lobby-connection"

describe("parseServerMessage", () => {
  it("keeps room routing fields on lobby state messages", () => {
    const message = parseServerMessage(JSON.stringify({
      type: "lobbyState",
      slug: "rogue-meteor-402",
      hostId: "host-1",
      selfId: "player-2",
      players: [
        {
          id: "host-1",
          username: "mike",
          color: "#74ffe0"
        },
        {
          id: "player-2",
          username: "zoe",
          color: "#fff4a6"
        }
      ],
      asteroidNames: {
        extraLarge: ["Alpha"],
        large: ["Beta"],
        medium: ["Gamma"],
        small: ["Omega"]
      },
      settings: defaultRoomSettings
    }))

    expect(message).toEqual(
      expect.objectContaining({
        type: "lobbyState",
        slug: "rogue-meteor-402",
        hostId: "host-1",
        selfId: "player-2"
      })
    )
  })

  it("keeps room routing fields on game started messages", () => {
    const message = parseServerMessage(JSON.stringify({
      type: "gameStarted",
      slug: "rogue-meteor-402",
      hostId: "host-1",
      selfId: "host-1",
      players: [
        {
          id: "host-1",
          username: "mike",
          color: "#74ffe0"
        }
      ],
      asteroidNames: {
        extraLarge: ["Alpha"],
        large: ["Beta"],
        medium: ["Gamma"],
        small: ["Omega"]
      },
      settings: defaultRoomSettings
    }))

    expect(message).toEqual(
      expect.objectContaining({
        type: "gameStarted",
        slug: "rogue-meteor-402",
        hostId: "host-1",
        selfId: "host-1"
      })
    )
  })

  it("parses player destruction messages with final ship state", () => {
    const message = parseServerMessage(JSON.stringify({
      type: "playerDestroyed",
      playerId: "player-2",
      ship: {
        position: { x: 120, y: 140 },
        velocity: { x: 1, y: 2 },
        angle: 0.5,
        isThrusting: false
      }
    }))

    expect(message).toEqual(
      expect.objectContaining({
        type: "playerDestroyed",
        playerId: "player-2",
        ship: expect.objectContaining({
          position: { x: 120, y: 140 }
        })
      })
    )
  })

  it("parses asteroid destruction messages with final asteroid position", () => {
    const message = parseServerMessage(JSON.stringify({
      type: "asteroidDestroyed",
      asteroid: {
        id: "asteroid-7",
        position: { x: 320, y: 480 },
        radius: 42,
        size: "large"
      }
    }))

    expect(message).toEqual(
      expect.objectContaining({
        type: "asteroidDestroyed",
        asteroid: {
          id: "asteroid-7",
          position: { x: 320, y: 480 },
          radius: 42,
          size: "large"
        }
      })
    )
  })

  it("parses powerup state messages", () => {
    const message = parseServerMessage(JSON.stringify({
      type: "powerUpState",
      powerUps: [
        {
          id: "power-up-1",
          type: "shield",
          radius: 16,
          position: { x: 10, y: 20 },
          velocity: { x: 120, y: 0 }
        }
      ]
    }))

    expect(message).toEqual(
      expect.objectContaining({
        type: "powerUpState",
        powerUps: [
          expect.objectContaining({
            id: "power-up-1",
            type: "shield"
          })
        ]
      })
    )
  })

  it("parses powerup collection effect messages", () => {
    const message = parseServerMessage(JSON.stringify({
      type: "powerUpCollected",
      playerId: "player-1",
      effectExpiresAt: 123456,
      powerUp: {
        id: "power-up-1",
        type: "scatterShot",
        radius: 16,
        position: { x: 10, y: 20 },
        velocity: { x: 120, y: 0 }
      }
    }))

    expect(message).toEqual(
      expect.objectContaining({
        type: "powerUpCollected",
        playerId: "player-1",
        effectExpiresAt: 123456
      })
    )
  })

  it("parses game over messages with recap", () => {
    const message = parseServerMessage(JSON.stringify({
      type: "gameOver",
      scores: {
        teamScore: 0,
        players: []
      },
      lives: {
        players: []
      },
      asteroidStats: {
        players: []
      },
      recap: {
        events: [
          {
            type: "gameStarted",
            elapsedSeconds: 0,
            label: "room launched"
          }
        ],
        highlights: {
          finalTenSeconds: []
        }
      }
    }))

    expect(message).toEqual(expect.objectContaining({
      type: "gameOver",
      recap: expect.objectContaining({
        events: [
          expect.objectContaining({
            type: "gameStarted"
          })
        ]
      })
    }))
  })
})
