type ClipboardWriter = {
  writeText: (text: string) => Promise<void>
}

export type CopyLobbyInviteResult = "copied" | "failed" | "unsupported"

export const copyLobbyInvite = async (
  inviteUrl: string,
  clipboard: ClipboardWriter | undefined = navigator.clipboard
): Promise<CopyLobbyInviteResult> => {
  if (!clipboard?.writeText) {
    return "unsupported"
  }

  try {
    await clipboard.writeText(inviteUrl)

    return "copied"
  } catch {
    return "failed"
  }
}
