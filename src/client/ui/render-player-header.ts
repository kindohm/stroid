import type { AppState } from "../app/app-state"
import { getLife } from "../game-runtime/player-life"

export const renderPlayerHeader = (state: AppState) => {
  document.querySelector(".player-header")?.remove()

  if (state.currentUsername.length === 0) {
    return
  }

  const header = document.createElement("header")
  const label = document.createElement("span")
  const name = document.createElement("strong")
  const lives = document.createElement("span")
  const editButton = document.createElement("button")
  const form = document.createElement("form")
  const input = document.createElement("input")
  const saveButton = document.createElement("button")
  const localLife = state.activeGame ? getLife(state.activeGame.lives, state.activeGame.selfId) : undefined
  const localPlayer = state.activeGame?.players.find((player) => player.id === state.activeGame?.selfId)
  const shipsLeft = localLife?.lives ?? 0

  header.className = "player-header"
  label.textContent = "pilot"
  name.textContent = state.currentUsername
  lives.className = "ship-lives"
  lives.setAttribute("aria-label", `${shipsLeft} ships left`)
  lives.hidden = !state.activeGame
  for (let index = 0; index < shipsLeft; index += 1) {
    const ship = document.createElement("span")

    ship.className = "ship-life-icon"
    ship.style.background = localPlayer?.color ?? "#74ffe0"
    ship.style.color = localPlayer?.color ?? "#74ffe0"
    lives.append(ship)
  }
  editButton.type = "button"
  editButton.textContent = "Change"
  form.className = "rename-form"
  form.hidden = true
  input.value = state.currentUsername
  input.maxLength = 18
  saveButton.type = "submit"
  saveButton.textContent = "Save"
  saveButton.disabled = input.value.trim().length === 0
  form.append(input, saveButton)
  header.append(label, name, lives, editButton, form)
  state.app.append(header)

  editButton.addEventListener("click", () => {
    form.hidden = false
    editButton.hidden = true
    input.value = state.currentUsername
    input.focus()
    input.select()
  })

  input.addEventListener("input", () => {
    saveButton.disabled = input.value.trim().length === 0
  })

  form.addEventListener("submit", (event) => {
    event.preventDefault()

    const nextUsername = input.value.trim()

    if (nextUsername.length === 0) {
      input.value = state.currentUsername
      saveButton.disabled = false
      return
    }

    state.currentUsername = nextUsername
    state.lobbyConnection?.rename(nextUsername)
    renderPlayerHeader(state)
  })
}
