import type { ScoreState } from "../../shared/lobby-types"

export const renderScorePanel = (scores: ScoreState, previousScores?: ScoreState) => {
  const panel = document.querySelector<HTMLElement>(".score-panel")

  if (!panel) {
    return
  }

  const totalLabel = document.createElement("span")
  const totalValue = document.createElement("strong")
  const totalRow = document.createElement("div")
  const heading = document.createElement("h2")
  const list = document.createElement("ol")
  const popLayer = document.createElement("div")

  totalLabel.textContent = "team"
  totalValue.textContent = scores.teamScore.toLocaleString()
  totalRow.className = "score-total"
  totalRow.append(totalLabel, totalValue)
  heading.textContent = "pilot scores"
  list.className = "score-list"
  popLayer.className = "score-pop-layer"

  scores.players.forEach((player, index) => {
    const item = document.createElement("li")
    const swatch = document.createElement("span")
    const name = document.createElement("span")
    const value = document.createElement("strong")
    const previousScore = previousScores?.players.find((score) => score.id === player.id)?.score
    const scoreDelta = previousScore === undefined ? 0 : player.score - previousScore

    item.className = "score-list-item"
    swatch.className = "score-swatch"
    swatch.style.background = player.color
    swatch.style.color = player.color
    name.textContent = player.username
    value.textContent = player.score.toLocaleString()
    item.append(swatch, name, value)
    list.append(item)

    if (scoreDelta > 0) {
      const pop = document.createElement("span")

      pop.className = "score-pop"
      pop.textContent = `+${scoreDelta.toLocaleString()}`
      pop.style.color = player.color
      pop.style.top = `${74 + index * 31}px`
      popLayer.append(pop)
    }
  })

  if (scores.players.length === 0) {
    const empty = document.createElement("li")

    empty.className = "score-empty"
    empty.textContent = "no scores yet"
    list.append(empty)
  }

  panel.replaceChildren(totalRow, heading, list, popLayer)
}
