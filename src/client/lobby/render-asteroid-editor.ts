import type { AsteroidNamePools } from "../../shared/lobby-types"
import { escapeHtml } from "../app/escape-html"
import { asteroidNameLabels, asteroidNameSizes } from "./asteroid-name-options"
import { formatAsteroidNameList } from "./format-asteroid-name-list"

export const renderAsteroidEditor = (asteroidNames: AsteroidNamePools) => `
  <section class="asteroid-name-editor" aria-label="Asteroid names">
    <div class="lobby-roster-header">
      <span>asteroid callsigns</span>
      <span>comma or newline</span>
    </div>
    ${asteroidNameSizes.map((size) => `
      <label>
        <span>${asteroidNameLabels[size]}</span>
        <textarea data-asteroid-size="${size}" rows="2">${escapeHtml(formatAsteroidNameList(asteroidNames[size]))}</textarea>
      </label>
    `).join("")}
  </section>
`
