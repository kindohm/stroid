import { createServer } from "node:http"
import { createServer as createViteServer } from "vite"
import { WebSocketServer } from "ws"
import { createLobby } from "./lobby"

const port = Number(process.env.PORT ?? 5173)
const host = process.env.HOST ?? "127.0.0.1"

const startServer = async () => {
  const vite = await createViteServer({
    server: {
      middlewareMode: true
    },
    appType: "spa"
  })
  const lobby = createLobby()
  const server = createServer((request, response) => {
    vite.middlewares(request, response, () => {
      response.statusCode = 404
      response.end("not found")
    })
  })
  const socketServer = new WebSocketServer({
    server,
    path: "/ws"
  })

  socketServer.on("connection", lobby.addClient)

  server.listen(port, host, () => {
    console.log(`stroid listening at http://${host}:${port}`)
  })
}

startServer()
