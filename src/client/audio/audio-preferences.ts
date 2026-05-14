export type AudioPreferences = {
  isMuted: boolean
  volume: number
}

const audioPreferencesStorageKey = "stroid.audioPreferences"
const defaultAudioPreferences: AudioPreferences = {
  isMuted: false,
  volume: 0.7
}

const clampVolume = (volume: number) => Math.min(1, Math.max(0, volume))

const sanitizeAudioPreferences = (value: unknown): AudioPreferences | undefined => {
  if (!value || typeof value !== "object") {
    return undefined
  }

  const source = value as Partial<Record<keyof AudioPreferences, unknown>>
  const volume = typeof source.volume === "number" && Number.isFinite(source.volume)
    ? clampVolume(source.volume)
    : defaultAudioPreferences.volume

  return {
    isMuted: source.isMuted === true,
    volume
  }
}

export const loadAudioPreferences = (): AudioPreferences => {
  try {
    const stored = localStorage.getItem(audioPreferencesStorageKey)

    if (!stored) {
      return defaultAudioPreferences
    }

    return sanitizeAudioPreferences(JSON.parse(stored)) ?? defaultAudioPreferences
  } catch {
    return defaultAudioPreferences
  }
}

export const saveAudioPreferences = (preferences: AudioPreferences) => {
  try {
    localStorage.setItem(audioPreferencesStorageKey, JSON.stringify(preferences))
  } catch {
    // Local storage is best-effort; audio should keep working without persistence.
  }
}
