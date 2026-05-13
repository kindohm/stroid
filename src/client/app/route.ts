export const getRouteLobbySlug = () => {
  const match = window.location.pathname.match(/^\/lobby\/([^/]+)$/)

  return match ? decodeURIComponent(match[1]) : undefined
}

export const setRoute = (slug?: string) => {
  const path = slug ? `/lobby/${encodeURIComponent(slug)}` : "/"

  if (window.location.pathname !== path) {
    window.history.pushState({}, "", path)
  }
}
