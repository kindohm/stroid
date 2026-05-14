import { sanitizeRoomSettings, type RoomSettings } from "../../../shared/room-settings"

export const getRoomSettingsFromElement = (
  roomSettingsElement: HTMLElement,
  fallback: RoomSettings
) => {
  const mapSize = roomSettingsElement.querySelector<HTMLSelectElement>("select[name='mapSize']")
  const asteroidDensity = roomSettingsElement.querySelector<HTMLInputElement>("input[name='asteroidDensity']")
  const playerLives = roomSettingsElement.querySelector<HTMLInputElement>("input[name='playerLives']")
  const maxShipSpeed = roomSettingsElement.querySelector<HTMLInputElement>("input[name='maxShipSpeed']")
  const friendlyFire = roomSettingsElement.querySelector<HTMLInputElement>("input[name='friendlyFire']")

  return sanitizeRoomSettings({
    mapSize: mapSize?.value ?? fallback.mapSize,
    asteroidDensity: Number(asteroidDensity?.value ?? fallback.asteroidDensity),
    playerLives: Number(playerLives?.value ?? fallback.playerLives),
    friendlyFire: friendlyFire?.checked ?? false,
    maxShipSpeed: Number(maxShipSpeed?.value ?? fallback.maxShipSpeed)
  })
}
