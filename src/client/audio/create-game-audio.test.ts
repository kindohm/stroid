import { beforeEach, describe, expect, it, vi } from "vitest"
import { createGameAudio } from "./create-game-audio"

const audioEvents: string[] = []
let audioContextConstructor: ReturnType<typeof vi.fn>

const createAudioParam = (initialValue = 0) => ({
  value: initialValue,
  cancelScheduledValues: vi.fn(),
  setTargetAtTime: vi.fn((value: number) => audioEvents.push(`target:${value}`)),
  setValueAtTime: vi.fn((value: number) => audioEvents.push(`set:${value}`)),
  exponentialRampToValueAtTime: vi.fn((value: number) => audioEvents.push(`ramp:${value}`))
})

const createOscillator = () => ({
  type: "sine" as OscillatorType,
  frequency: createAudioParam(440),
  connect: vi.fn(),
  start: vi.fn(() => audioEvents.push("start")),
  stop: vi.fn(() => audioEvents.push("stop"))
})

const createGain = () => ({
  gain: createAudioParam(1),
  connect: vi.fn()
})

const createAudioContext = () => ({
  currentTime: 1,
  destination: {},
  state: "running",
  close: vi.fn(),
  createGain: vi.fn(createGain),
  createOscillator: vi.fn(createOscillator),
  resume: vi.fn()
})

const createStorage = () => {
  const values = new Map<string, string>()

  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value)
    })
  }
}

describe("createGameAudio", () => {
  beforeEach(() => {
    audioEvents.length = 0
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: createStorage()
    })
    audioContextConstructor = vi.fn(createAudioContext)
    Object.defineProperty(globalThis, "AudioContext", {
      configurable: true,
      value: audioContextConstructor
    })
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        AudioContext: audioContextConstructor,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      }
    })
  })

  it("creates no audio context until sound is requested", () => {
    createGameAudio()

    expect(audioContextConstructor).not.toHaveBeenCalled()
  })

  it("plays fire as a one-shot oscillator", () => {
    const audio = createGameAudio()

    audio.playFire()

    expect(audioContextConstructor).toHaveBeenCalledOnce()
    expect(audioEvents).toContain("start")
    expect(audioEvents).toContain("stop")
  })

  it("keeps thrust oscillator reusable", () => {
    const audio = createGameAudio()

    audio.setThrusting(true)
    audio.setThrusting(false)

    expect(audioContextConstructor).toHaveBeenCalledOnce()
    expect(audioEvents.filter((event) => event === "start")).toHaveLength(1)
    expect(audioEvents).toContain("target:0.08")
    expect(audioEvents).toContain("target:0.0001")
  })

  it("does not play one-shots while muted", () => {
    const audio = createGameAudio()

    audio.setMuted(true)
    audio.playFire()

    expect(audioEvents).not.toContain("start")
  })

  it("can unlock audio from a user gesture before the first game tick", () => {
    const audio = createGameAudio()

    audio.unlock()

    expect(audioContextConstructor).toHaveBeenCalledOnce()
  })
})
