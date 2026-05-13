const playerPalette = [
  "#74ffe0",
  "#fff4a6",
  "#ff7a90",
  "#8fb7ff",
  "#b6ff6a",
  "#ff9f43",
  "#d69cff",
  "#65f4ff"
] as const

export const assignPlayerColor = (username: string) => {
  const hash = [...username].reduce(
    (sum, character) => sum + character.charCodeAt(0),
    username.length
  )

  return playerPalette[hash % playerPalette.length]
}
