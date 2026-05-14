import { createAppState } from "./app/app-state"
import { renderLobby } from "./lobby/render-lobby/render-lobby"
import "./styles.css"

const app = document.querySelector<HTMLDivElement>("#app")

if (!app) {
  throw new Error("Missing #app")
}

const state = createAppState(app)

window.addEventListener("popstate", () => {
  renderLobby(state)
})

renderLobby(state)
