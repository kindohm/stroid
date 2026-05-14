import type { GameAudio } from "./create-game-audio"

export const renderAudioControls = (audio: GameAudio) => {
  document.querySelector(".audio-panel")?.remove()

  const preferences = audio.getPreferences()
  const panel = document.createElement("aside")
  const label = document.createElement("label")
  const labelText = document.createElement("span")
  const row = document.createElement("div")
  const muteButton = document.createElement("button")
  const volume = document.createElement("input")

  panel.className = "audio-panel"
  panel.setAttribute("aria-label", "Audio controls")
  labelText.textContent = "audio"
  row.className = "audio-control-row"
  muteButton.className = "secondary-button"
  muteButton.type = "button"
  muteButton.textContent = preferences.isMuted ? "Muted" : "Sound"
  volume.type = "range"
  volume.min = "0"
  volume.max = "1"
  volume.step = "0.05"
  volume.value = String(preferences.volume)
  label.append(labelText, volume)
  row.append(muteButton, label)
  panel.append(row)
  document.body.append(panel)

  muteButton.addEventListener("click", () => {
    const nextMuted = !audio.getPreferences().isMuted

    audio.setMuted(nextMuted)
    muteButton.textContent = nextMuted ? "Muted" : "Sound"
  })

  volume.addEventListener("input", () => {
    const nextVolume = Number(volume.value)

    audio.setVolume(nextVolume)
    muteButton.textContent = audio.getPreferences().isMuted ? "Muted" : "Sound"
  })
}
