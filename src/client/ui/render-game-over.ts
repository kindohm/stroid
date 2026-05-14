import type { AsteroidStatsState, RegularAsteroidNameSize, GameRecap, GameRecapEvent, ScoreState } from "../../shared/lobby-types"
import type { AppState } from "../app/app-state"
import { regularAsteroidNameSizes } from "../lobby/asteroid-name-options"

const formatTime = (elapsedSeconds: number) => {
  const minutes = Math.floor(elapsedSeconds / 60)
  const seconds = Math.floor(elapsedSeconds % 60)

  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

const powerUpLabelByType = {
  shield: "shield",
  scatterShot: "scatter shot",
  asteroidFreeze: "asteroid freeze"
}

const deathCauseLabel = {
  asteroid: "asteroid impact",
  friendlyProjectile: "friendly fire",
  shipCollision: "ship collision",
  unknown: "ship lost"
}

const getEventText = (event: GameRecapEvent) => {
  if (event.type === "gameStarted" || event.type === "gameOver") {
    return event.label
  }

  if (event.type === "asteroidDestroyed") {
    return `${event.player.username} destroyed ${event.asteroidName} +${event.scoreDelta}`
  }

  if (event.type === "powerUpCollected") {
    return `${event.player.username} collected ${powerUpLabelByType[event.powerUpType]}`
  }

  return `${event.player.username} lost a ship - ${deathCauseLabel[event.cause]} (${event.livesRemaining} left)`
}

const appendRecapEvent = (list: HTMLOListElement, event: GameRecapEvent) => {
  const item = document.createElement("li")
  const time = document.createElement("span")
  const message = document.createElement("span")

  item.className = `black-box-event black-box-event-${event.type}`
  time.textContent = formatTime(event.elapsedSeconds)
  message.textContent = getEventText(event)

  if ("player" in event) {
    message.style.color = event.player.color
  }

  item.append(time, message)
  list.append(item)
}

const renderBlackBox = (recap: GameRecap | undefined) => {
  const section = document.createElement("section")
  const heading = document.createElement("h2")
  const highlights = document.createElement("div")
  const finalHeading = document.createElement("h3")
  const finalList = document.createElement("ol")
  const events = recap?.highlights.finalTenSeconds ?? []

  section.className = "black-box-panel"
  heading.textContent = "Black Box"
  highlights.className = "black-box-highlights"
  finalHeading.textContent = "Final 10 seconds"
  finalList.className = "black-box-list"

  if (recap?.highlights.firstPlayerHit) {
    const item = document.createElement("p")

    item.textContent = `First hit: ${getEventText(recap.highlights.firstPlayerHit)}`
    highlights.append(item)
  }

  if (recap?.highlights.finalAsteroidDestroyed) {
    const item = document.createElement("p")

    item.textContent = `Final asteroid: ${getEventText(recap.highlights.finalAsteroidDestroyed)}`
    highlights.append(item)
  }

  if (recap?.highlights.biggestScoreStreak) {
    const streak = recap.highlights.biggestScoreStreak
    const item = document.createElement("p")

    item.textContent = `Hot streak: ${streak.player.username} scored ${streak.score.toLocaleString()} across ${streak.asteroidCount} hits`
    item.style.color = streak.player.color
    highlights.append(item)
  }

  if (highlights.children.length === 0) {
    const item = document.createElement("p")

    item.textContent = "No notable signals recorded"
    highlights.append(item)
  }

  if (events.length === 0) {
    const item = document.createElement("li")

    item.className = "black-box-empty"
    item.textContent = "no final telemetry"
    finalList.append(item)
  } else {
    events.forEach((event) => appendRecapEvent(finalList, event))
  }

  section.append(heading, highlights, finalHeading, finalList)

  return section
}

export const renderGameOver = (
  state: AppState,
  scores: ScoreState,
  asteroidStats: AsteroidStatsState | undefined,
  recap: GameRecap | undefined,
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
  const blackBox = renderBlackBox(recap)
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
    const rows = regularAsteroidNameSizes
      .flatMap((size: RegularAsteroidNameSize) => {
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

  panel.append(eyebrow, title, total, list, blackBox, asteroidLeaders, backButton)
  overlay.append(panel)
  state.app.append(overlay)
}
