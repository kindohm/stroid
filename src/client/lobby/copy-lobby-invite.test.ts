import { describe, expect, it, vi } from "vitest"
import { copyLobbyInvite } from "./copy-lobby-invite"

describe("copyLobbyInvite", () => {
  it("writes the invite URL to the Clipboard API", async () => {
    const clipboard = {
      writeText: vi.fn().mockResolvedValue(undefined)
    }

    await expect(copyLobbyInvite("https://stroid.test/lobby/abc", clipboard)).resolves.toBe("copied")
    expect(clipboard.writeText).toHaveBeenCalledWith("https://stroid.test/lobby/abc")
  })

  it("reports unsupported when no Clipboard API is available", async () => {
    await expect(copyLobbyInvite("https://stroid.test/lobby/abc", undefined)).resolves.toBe("unsupported")
  })

  it("reports failure when clipboard write rejects", async () => {
    const clipboard = {
      writeText: vi.fn().mockRejectedValue(new Error("denied"))
    }

    await expect(copyLobbyInvite("https://stroid.test/lobby/abc", clipboard)).resolves.toBe("failed")
  })
})
