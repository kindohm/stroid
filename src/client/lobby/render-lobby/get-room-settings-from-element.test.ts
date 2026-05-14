import { describe, expect, it } from "vitest"
import { defaultRoomSettings } from "../../../shared/room-settings"
import { getRoomSettingsFromElement } from "./get-room-settings-from-element"

const createInput = (value: string, checked = false) => ({
  value,
  checked
})

describe("getRoomSettingsFromElement", () => {
  it("reads and sanitizes controls from the room settings element", () => {
    const element = {
      querySelector: (selector: string) => {
        const values: Record<string, unknown> = {
          "select[name='mapSize']": createInput("huge"),
          "input[name='asteroidDensity']": createInput("0.75"),
          "input[name='playerLives']": createInput("4"),
          "input[name='maxShipSpeed']": createInput("1800"),
          "input[name='bossIntervalMinutes']": createInput("7"),
          "input[name='bossHealthPerPlayer']": createInput("40"),
          "input[name='friendlyFire']": createInput("", true)
        }

        return values[selector] ?? undefined
      }
    } as unknown as HTMLElement

    expect(getRoomSettingsFromElement(element, defaultRoomSettings)).toEqual({
      mapSize: "huge",
      asteroidDensity: 0.75,
      playerLives: 4,
      friendlyFire: true,
      maxShipSpeed: 1800,
      bossIntervalMinutes: 7,
      bossHealthPerPlayer: 40
    })
  })

  it("falls back to previous settings when controls are missing", () => {
    const element = {
      querySelector: () => undefined
    } as unknown as HTMLElement

    expect(getRoomSettingsFromElement(element, defaultRoomSettings)).toEqual({
      ...defaultRoomSettings,
      friendlyFire: false
    })
  })
})
