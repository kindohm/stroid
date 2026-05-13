import type { PlayerInput } from "../../shared/game-types"

const gameKeys = new Set(["ArrowUp", "ArrowLeft", "ArrowRight", " "])

export const createKeyboardInput = (target: Window) => {
  const pressed = new Set<string>()

  const updateKey = (event: KeyboardEvent, isPressed: boolean) => {
    if (!gameKeys.has(event.key)) {
      return
    }

    event.preventDefault()

    if (isPressed) {
      pressed.add(event.key)
      return
    }

    pressed.delete(event.key)
  }

  const onKeyDown = (event: KeyboardEvent) => updateKey(event, true)
  const onKeyUp = (event: KeyboardEvent) => updateKey(event, false)

  target.addEventListener("keydown", onKeyDown)
  target.addEventListener("keyup", onKeyUp)

  return {
    read: (): PlayerInput => ({
      thrust: pressed.has("ArrowUp"),
      turnLeft: pressed.has("ArrowLeft"),
      turnRight: pressed.has("ArrowRight"),
      fire: pressed.has(" ")
    }),
    destroy: () => {
      target.removeEventListener("keydown", onKeyDown)
      target.removeEventListener("keyup", onKeyUp)
    }
  }
}
