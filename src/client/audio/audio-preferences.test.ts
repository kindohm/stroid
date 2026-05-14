import { beforeEach, describe, expect, it, vi } from "vitest"
import { loadAudioPreferences, saveAudioPreferences } from "./audio-preferences"

const createStorage = () => {
  const values = new Map<string, string>()

  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value)
    })
  }
}

describe("audioPreferences", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: createStorage()
    })
  })

  it("loads defaults when storage is empty", () => {
    expect(loadAudioPreferences()).toEqual({
      isMuted: false,
      volume: 0.7
    })
  })

  it("clamps stored volume", () => {
    localStorage.setItem("stroid.audioPreferences", JSON.stringify({
      isMuted: true,
      volume: 3
    }))

    expect(loadAudioPreferences()).toEqual({
      isMuted: true,
      volume: 1
    })
  })

  it("saves preferences as json", () => {
    saveAudioPreferences({
      isMuted: true,
      volume: 0.25
    })

    expect(localStorage.setItem).toHaveBeenCalledWith(
      "stroid.audioPreferences",
      JSON.stringify({
        isMuted: true,
        volume: 0.25
      })
    )
  })
})
