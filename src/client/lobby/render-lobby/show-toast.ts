export const showToast = (app: HTMLElement, message: string, tone: "success" | "failure") => {
  document.querySelector(".toast")?.remove()

  const toast = document.createElement("div")

  toast.className = `toast toast-${tone}`
  toast.setAttribute("role", "status")
  toast.textContent = message
  app.append(toast)
  window.setTimeout(() => toast.remove(), 2200)
}
