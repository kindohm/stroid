import type { RandomSource } from "./random-source"

export const createAsteroidShape = (random: RandomSource, points = 11) =>
  Array.from({ length: points }, () => 0.74 + random() * 0.42)
