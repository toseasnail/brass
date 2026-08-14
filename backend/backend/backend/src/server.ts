import express from 'express'
import http from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import { GameEngine } from './game-engine/engine'

const app = express()
app.use(cors())
app.use(express.json())

// health-check endpoint for quick connection testing
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() })
})

const server = http.createServer(app)
const io = new Server(server, { cors: { origin: '*' } })

let engine: GameEngine | null = null
try {
  engine = new GameEngine(io)
  // Attach socket handlers for engine control (engine:performAction, engine:startGame, etc.)
  engine.attachSocketHandlers()
  console.log('[server] GameEngine initialized')
} catch (err) {
  console.error('[server] Failed to initialize GameEngine:', err)
}

// Simple rooms API
app.post('/api/rooms', (req, res) => {
  if (!engine) return res.status(500).send({ ok: false, reason: 'engine not initialized' })
  const name = req.body.name || 'Player'
  const roomId = engine.createRoom(name)
  res.json({ roomId })
})

app.post('/api/rooms/:roomId/join', (req, res) => {
  if (!engine) return res.status(500).send({ ok: false, reason: 'engine not initialized' })
  const roomId = req.params.roomId
  const name = req.body.name || 'Player'
  const ok = engine.joinRoom(roomId, name)
  if (ok) res.status(200).send({ ok: true })
  else res.status(404).send({ ok: false })
})

app.post('/api/rooms/:roomId/add-ai', (req, res) => {
  if (!engine) return res.status(500).send({ ok: false, reason: 'engine not initialized' })
  const roomId = req.params.roomId
  const level = req.body.level || 1
  engine.addAI(roomId, level)
  res.status(200).send({ ok: true })
})

io.on('connection', (socket) => {
  socket.on('room:subscribe', ({ roomId }) => {
    socket.join(roomId)
  })
  socket.on('room:unsubscribe', ({ roomId }) => {
    socket.leave(roomId)
  })
})

// Crash-safe logging for unhandled errors
process.on('uncaughtException', (err) => {
  console.error('[process] uncaughtException', err)
})
process.on('unhandledRejection', (reason) => {
  console.error('[process] unhandledRejection', reason)
})

const PORT = Number(process.env.PORT) || 8080
console.log('[server] starting listen on port', PORT)
server.listen(PORT, () => console.log('[server] Listening on port', PORT))

export { app, server, io }
