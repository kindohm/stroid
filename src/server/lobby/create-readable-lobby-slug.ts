import { randomUUID } from "node:crypto"

const slugAdjectives = [
  "bright",
  "cinder",
  "cosmic",
  "drift",
  "ember",
  "fuzzy",
  "golden",
  "hollow",
  "lunar",
  "neon",
  "rogue",
  "solar"
]
const slugNouns = [
  "beacon",
  "comet",
  "crater",
  "meteor",
  "orbit",
  "pulse",
  "rocket",
  "signal",
  "spark",
  "stroid",
  "vector",
  "voyage"
]

export const createReadableLobbySlug = (hasSlug: (slug: string) => boolean, random = Math.random) => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const adjective = slugAdjectives[Math.floor(random() * slugAdjectives.length)]
    const noun = slugNouns[Math.floor(random() * slugNouns.length)]
    const suffix = Math.floor(100 + random() * 900)
    const slug = `${adjective}-${noun}-${suffix}`

    if (!hasSlug(slug)) {
      return slug
    }
  }

  return `stroid-${randomUUID().slice(0, 8)}`
}
