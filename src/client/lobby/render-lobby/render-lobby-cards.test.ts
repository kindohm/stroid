import { describe, expect, it } from "vitest"
import { renderLobbyCards } from "./render-lobby-cards"

describe("renderLobbyCards", () => {
  it("renders an empty state when no lobbies exist", () => {
    expect(renderLobbyCards([])).toContain("no lobbies yet")
  })

  it("renders lobby metadata and offers spectating for live games", () => {
    const html = renderLobbyCards([{
      slug: "hot-rock",
      hostId: "mike",
      hostUsername: "mike",
      playerCount: 2,
      gameInProgress: true
    }])

    expect(html).toContain("hot-rock")
    expect(html).toContain("mike / 2 pilots")
    expect(html).toContain("in progress")
    expect(html).toContain("Spectate")
  })
})
