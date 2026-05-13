import { describe, expect, it, vi } from "vitest"
import { createKeyboardInput } from "./create-keyboard-input"

const createTarget = () => {
  const listeners = new Map<string, (event: KeyboardEvent) => void>()

  return {
    target: {
      addEventListener: vi.fn((type: string, listener: (event: KeyboardEvent) => void) => {
        listeners.set(type, listener)
      }),
      removeEventListener: vi.fn()
    } as unknown as Window,
    fire: (type: string, event: KeyboardEvent) => {
      listeners.get(type)?.(event)
    }
  }
}

describe("createKeyboardInput", () => {
  it("maps arrow keys to player input", () => {
    const { target, fire } = createTarget()
    const keyboard = createKeyboardInput(target)
    const event = {
      key: "ArrowUp",
      preventDefault: vi.fn()
    } as unknown as KeyboardEvent

    fire("keydown", event)

    expect(keyboard.read()).toEqual({
      thrust: true,
      turnLeft: false,
      turnRight: false,
      fire: false
    })
    expect(event.preventDefault).toHaveBeenCalled()
  })

  it("clears released keys", () => {
    const { target, fire } = createTarget()
    const keyboard = createKeyboardInput(target)

    fire("keydown", {
      key: "ArrowLeft",
      preventDefault: vi.fn()
    } as unknown as KeyboardEvent)
    fire("keyup", {
      key: "ArrowLeft",
      preventDefault: vi.fn()
    } as unknown as KeyboardEvent)

    expect(keyboard.read().turnLeft).toBe(false)
  })

  it("reads space as held fire input", () => {
    const { target, fire } = createTarget()
    const keyboard = createKeyboardInput(target)

    fire("keydown", {
      key: " ",
      preventDefault: vi.fn()
    } as unknown as KeyboardEvent)

    expect(keyboard.read().fire).toBe(true)
    expect(keyboard.read().fire).toBe(true)

    fire("keyup", {
      key: " ",
      preventDefault: vi.fn()
    } as unknown as KeyboardEvent)

    expect(keyboard.read().fire).toBe(false)
  })
})
