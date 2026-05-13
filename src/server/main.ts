import { readFile } from "node:fs/promises"
import { createServer } from "node:http"
import { extname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import type { IncomingMessage, ServerResponse } from "node:http"
import { WebSocketServer } from "ws"
import { createLobbyManager } from "./lobby/create-lobby-manager"

const port = Number(process.env.PORT ?? 5173)
const host = process.env.HOST ?? "127.0.0.1"
const isProduction = process.env.NODE_ENV === "production"
const distPath = resolve(fileURLToPath(new URL("../..", import.meta.url)), "dist")
const contentTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
}

const sendFile = async (response: ServerResponse, filePath: string) => {
  const body = await readFile(filePath)
  const contentType = contentTypes[extname(filePath)] ?? "application/octet-stream"

  response.writeHead(200, {
    "Content-Length": body.byteLength,
    "Content-Type": contentType
  })
  response.end(body)
}

const createProductionHandler = () => async (request: IncomingMessage, response: ServerResponse) => {
  if (!request.url || (request.method !== "GET" && request.method !== "HEAD")) {
    response.statusCode = 404
    response.end("not found")
    return
  }

  try {
    const url = new URL(request.url, `http://${request.headers.host ?? `${host}:${port}`}`)
    const requestedPath = decodeURIComponent(url.pathname)
    const candidatePath = join(distPath, requestedPath === "/" ? "index.html" : requestedPath)
    const safePath = relative(distPath, candidatePath).startsWith("..") ? join(distPath, "index.html") : candidatePath

    await sendFile(response, safePath)
  } catch {
    await sendFile(response, join(distPath, "index.html"))
  }
}

const createDevelopmentHandler = async () => {
  const { createServer: createViteServer } = await import("vite")
  const vite = await createViteServer({
    server: {
      middlewareMode: true
    },
    appType: "spa"
  })

  return (request: IncomingMessage, response: ServerResponse) => {
    vite.middlewares(request, response, () => {
      response.statusCode = 404
      response.end("not found")
    })
  }
}

const startServer = async () => {
  const requestHandler = isProduction ? createProductionHandler() : await createDevelopmentHandler()
  const lobbyManager = createLobbyManager()
  const server = createServer(requestHandler)
  const socketServer = new WebSocketServer({
    server,
    path: "/ws"
  })

  socketServer.on("connection", lobbyManager.addClient)

  server.listen(port, host, () => {
    console.log(`stroid listening at http://${host}:${port}`)
  })
}

startServer()
