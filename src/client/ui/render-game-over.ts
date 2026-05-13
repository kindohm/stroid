import type { AsteroidStatsState, AsteroidNameSize, ScoreState } from "../../shared/lobby-types"
import type { AppState } from "../app/app-state"
import { asteroidNameSizes } from "../lobby/asteroid-name-options"

export const renderGameOver = (
  state: AppState,
  scores: ScoreState,
  asteroidStats: AsteroidStatsState | undefined,
  onBackToLobby: () => void
) => {
  document.querySelector(".game-over-panel")?.remove()

  const overlay = document.createElement("section")
  const panel = document.createElement("div")
  const eyebrow = document.createElement("p")
  const title = document.createElement("h1")
  const total = document.createElement("strong")
  const list = document.createElement("ol")
  const asteroidLeaders = document.createElement("section")
  const backButton = document.createElement("button")

  overlay.className = "game-over-panel"
  panel.className = "game-over-card"
  eyebrow.className = "signal"
  eyebrow.textContent = "all ships lost"
  title.textContent = "Game over"
  total.className = "game-over-total"
  total.textContent = `Team score ${scores.teamScore.toLocaleString()}`
  list.className = "game-over-list"
  asteroidLeaders.className = "game-over-asteroid-leaders"

  scores.players.forEach((player) => {
    const item = document.createElement("li")
    const swatch = document.createElement("span")
    const name = document.createElement("span")
    const value = document.createElement("strong")

    swatch.className = "score-swatch"
    swatch.style.background = player.color
    swatch.style.color = player.color
    name.textContent = player.username
    value.textContent = player.score.toLocaleString()
    item.append(swatch, name, value)
    list.append(item)
  })

  if (asteroidStats) {
    const heading = document.createElement("h2")
    const table = document.createElement("table")
    const tableHead = document.createElement("thead")
    const tableBody = document.createElement("tbody")
    const headerRow = document.createElement("tr")
    const rows = asteroidNameSizes
      .flatMap((size: AsteroidNameSize) => {
        const asteroidNames = new Set<string>()

        asteroidStats.players.forEach((player) => {
          Object.keys(player.destroyedNamesBySize[size]).forEach((name) => asteroidNames.add(name))
        })

        return [...asteroidNames].map((asteroidName) => {
          const leader = asteroidStats.players
            .map((player) => ({
              ...player,
              killCount: player.destroyedNamesBySize[size][asteroidName] ?? 0
            }))
            .sort((left, right) => right.killCount - left.killCount || left.username.localeCompare(right.username))[0]

          return {
            asteroidName,
            leader,
            size
          }
        })
      })
      .filter((row) => row.leader.killCount > 0)
      .sort((left, right) => left.size.localeCompare(right.size) || left.asteroidName.localeCompare(right.asteroidName))

    heading.textContent = "Asteroid name leaders"
    table.className = "game-over-asteroid-table"
    ;["Asteroid", "Pilot", "Kills"].forEach((label) => {
      const cell = document.createElement("th")

      cell.textContent = label
      headerRow.append(cell)
    })
    tableHead.append(headerRow)

    rows.forEach((leaderRow) => {
      const row = document.createElement("tr")
      const asteroidName = document.createElement("td")
      const pilot = document.createElement("td")
      const kills = document.createElement("td")

      asteroidName.textContent = leaderRow.asteroidName
      pilot.textContent = leaderRow.leader.username
      pilot.style.color = leaderRow.leader.color
      kills.textContent = leaderRow.leader.killCount.toLocaleString()
      row.append(asteroidName, pilot, kills)
      tableBody.append(row)
    })

    if (rows.length === 0) {
      const row = document.createElement("tr")
      const empty = document.createElement("td")

      empty.colSpan = 3
      empty.textContent = "no named hits"
      row.append(empty)
      tableBody.append(row)
    }

    table.append(tableHead, tableBody)
    asteroidLeaders.append(heading, table)
  }

  backButton.type = "button"
  backButton.textContent = "Back to lobby"
  backButton.addEventListener("click", onBackToLobby)

  panel.append(eyebrow, title, total, list, asteroidLeaders, backButton)
  overlay.append(panel)
  state.app.append(overlay)
}
