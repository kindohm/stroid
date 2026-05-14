import type { PlayerStats } from "../../../shared/player-stats"

const formatInteger = (value: number) => Math.round(value).toLocaleString()

const formatPercent = (value: number) => `${Math.round(value * 100)}%`

const getTopAsteroidName = (stats: PlayerStats) => {
  const [name, count] = Object.entries(stats.asteroidHitsByName)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0] ?? []

  return name && count ? `${name} x${count}` : "no trophies yet"
}

export const getPilotStyle = (stats: PlayerStats) => {
  const hitRate = stats.shotsFired > 0 ? stats.asteroidsHit / stats.shotsFired : 0
  const thrustPerGame = stats.gamesPlayed > 0 ? stats.thrustSeconds / stats.gamesPlayed : 0
  const shotsPerGame = stats.gamesPlayed > 0 ? stats.shotsFired / stats.gamesPlayed : 0

  if (stats.gamesPlayed === 0) {
    return "fresh signal"
  }

  if (hitRate >= 0.45 && shotsPerGame <= 80) {
    return "patient deadeye"
  }

  if (hitRate >= 0.3) {
    return "rock surgeon"
  }

  if (thrustPerGame >= 90) {
    return "full burn"
  }

  if (shotsPerGame >= 160) {
    return "spray pilot"
  }

  return "steady hand"
}

export const createPilotLogElement = (stats: PlayerStats | undefined) => {
  const log = document.createElement("div")

  log.className = "pilot-log"

  if (!stats || stats.gamesPlayed === 0) {
    log.innerHTML = `
      <span class="pilot-log-style">fresh signal</span>
      <span class="pilot-log-empty">no local flight record shared yet</span>
    `
    return log
  }

  const hitRate = stats.shotsFired > 0 ? stats.asteroidsHit / stats.shotsFired : 0
  const totalDeaths = Object.values(stats.deathsByCause).reduce((sum, count) => sum + count, 0)
  const totalPowerUps = Object.values(stats.powerUpsCollected).reduce((sum, count) => sum + count, 0)
  const rows = [
    ["sorties", formatInteger(stats.gamesPlayed)],
    ["best", formatInteger(stats.bestGameScore)],
    ["contact", formatPercent(hitRate)],
    ["boss", `${formatInteger(stats.bossHits)} / ${formatInteger(stats.bossDefeats)}`],
    ["power", formatInteger(totalPowerUps)],
    ["lost", formatInteger(totalDeaths)]
  ]

  log.innerHTML = `
    <div class="pilot-log-topline">
      <span class="pilot-log-style">${getPilotStyle(stats)}</span>
      <span class="pilot-log-trophy">${getTopAsteroidName(stats)}</span>
    </div>
    <dl class="pilot-log-grid">
      ${rows.map(([label, value]) => `
        <div>
          <dt>${label}</dt>
          <dd>${value}</dd>
        </div>
      `).join("")}
    </dl>
  `

  return log
}
