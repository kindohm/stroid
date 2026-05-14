import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { defaultRoomSettings, sanitizeRoomSettings } from "../../shared/room-settings"
import { defaultAsteroidNames } from "./default-asteroid-names"
import type { LobbySnapshot, LobbyStore } from "./lobby-snapshot"
import { sanitizeAsteroidNames } from "./sanitize-asteroid-names"

const isSafeSlug = (slug: string) => /^[a-z0-9-]+$/.test(slug)

const sanitizeSnapshot = (value: unknown): LobbySnapshot | undefined => {
  if (!value || typeof value !== "object") {
    return undefined
  }

  const source = value as Partial<LobbySnapshot>

  if (
    typeof source.slug !== "string" ||
    !isSafeSlug(source.slug) ||
    typeof source.hostSessionId !== "string" ||
    typeof source.hostUsername !== "string"
  ) {
    return undefined
  }

  const now = Date.now()

  return {
    slug: source.slug,
    hostSessionId: source.hostSessionId,
    hostUsername: source.hostUsername,
    asteroidNames: sanitizeAsteroidNames(source.asteroidNames, defaultAsteroidNames),
    settings: sanitizeRoomSettings(source.settings ?? defaultRoomSettings),
    createdAt: typeof source.createdAt === "number" ? source.createdAt : now,
    updatedAt: typeof source.updatedAt === "number" ? source.updatedAt : now
  }
}

export const createFileLobbyStore = (dataDirectory: string): LobbyStore => {
  const lobbiesDirectory = join(dataDirectory, "lobbies")
  const getFilePath = (slug: string) => join(lobbiesDirectory, `${slug}.json`)

  return {
    delete: async (slug) => {
      if (!isSafeSlug(slug)) {
        return
      }

      await rm(getFilePath(slug), {
        force: true
      })
    },
    loadAll: async () => {
      try {
        await mkdir(lobbiesDirectory, {
          recursive: true
        })
        const files = await readdir(lobbiesDirectory)
        const snapshots = await Promise.all(
          files
            .filter((file) => file.endsWith(".json"))
            .map(async (file) => {
              try {
                return sanitizeSnapshot(JSON.parse(await readFile(join(lobbiesDirectory, file), "utf8")))
              } catch {
                return undefined
              }
            })
        )

        return snapshots.filter((snapshot): snapshot is LobbySnapshot => Boolean(snapshot))
      } catch {
        return []
      }
    },
    save: async (snapshot) => {
      if (!isSafeSlug(snapshot.slug)) {
        return
      }

      await mkdir(lobbiesDirectory, {
        recursive: true
      })
      await writeFile(getFilePath(snapshot.slug), `${JSON.stringify(snapshot, null, 2)}\n`)
    }
  }
}
