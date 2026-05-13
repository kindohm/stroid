import type { WebSocket } from "ws"
import type { Projectile } from "../../shared/game-types"
import type { ClientLobbyMessage } from "../../shared/lobby-types"
import { defaultAsteroidNames } from "./default-asteroid-names"
import { sanitizeAsteroidNames } from "./sanitize-asteroid-names"
import { sanitizeUsername } from "./sanitize-username"

export const parseClientMessage = (data: WebSocket.RawData): ClientLobbyMessage | undefined => {
  try {
    const message = JSON.parse(data.toString()) as Partial<ClientLobbyMessage>

    if (message.type === "startGame") {
      return {
        type: "startGame"
      }
    }

    if (message.type === "setAsteroidNames") {
      return {
        type: "setAsteroidNames",
        asteroidNames: sanitizeAsteroidNames(message.asteroidNames, defaultAsteroidNames)
      }
    }

    if (message.type === "playerState" && typeof message.ship === "object" && message.ship) {
      return {
        type: "playerState",
        ship: message.ship
      } as ClientLobbyMessage
    }

    if (message.type === "asteroidHit" && typeof message.asteroidId === "string") {
      return {
        type: "asteroidHit",
        asteroidId: message.asteroidId
      }
    }

    if (message.type === "playerHit" && typeof message.ship === "object" && message.ship) {
      return {
        type: "playerHit",
        ship: message.ship
      }
    }

    if (message.type === "projectileFired" && typeof message.projectile === "object" && message.projectile) {
      return {
        type: "projectileFired",
        projectile: message.projectile as Projectile
      }
    }

    if (message.type === "setUsername" && typeof message.username === "string") {
      return {
        type: "setUsername",
        username: sanitizeUsername(message.username)
      }
    }

    if (message.type === "renamePlayer" && typeof message.username === "string") {
      return {
        type: "renamePlayer",
        username: sanitizeUsername(message.username)
      }
    }

    if (message.type === "createLobby") {
      return {
        type: "createLobby",
        asteroidNames:
          typeof message.asteroidNames === "object" && message.asteroidNames
            ? sanitizeAsteroidNames(message.asteroidNames, defaultAsteroidNames)
            : undefined
      }
    }

    if (message.type === "joinLobby" && typeof (message as { username?: unknown }).username === "string") {
      return {
        type: "renamePlayer",
        username: sanitizeUsername((message as { username: string }).username),
        asteroidNames:
          typeof message.asteroidNames === "object" && message.asteroidNames
            ? sanitizeAsteroidNames(message.asteroidNames, defaultAsteroidNames)
            : undefined
      }
    }

    if (message.type === "joinLobby" && typeof message.slug === "string") {
      return {
        type: "joinLobby",
        slug: message.slug.trim().toLowerCase(),
        asteroidNames:
          typeof message.asteroidNames === "object" && message.asteroidNames
            ? sanitizeAsteroidNames(message.asteroidNames, defaultAsteroidNames)
            : undefined
      }
    }

    if (message.type === "leaveLobby") {
      return {
        type: "leaveLobby"
      }
    }

    if (message.type === "listLobbies") {
      return {
        type: "listLobbies"
      }
    }

    return undefined
  } catch {
    return undefined
  }
}
