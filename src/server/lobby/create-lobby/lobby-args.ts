export type LobbyArgs = {
  hostId: string
  slug: string
  onChanged?: () => void
  onEmpty?: (slug: string) => void
}
