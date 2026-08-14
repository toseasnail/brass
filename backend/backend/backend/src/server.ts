import express from 'express'
import http from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import { GameEngine } from './game-engine/engine'

const app = express()
app.use(cors())
app.use(express.json())

const server = http.createServer(app)
const io = new Server(server, {cors:{origin:'*'}})

const engine = new GameEngine(io)

// Simple rooms API
app.post('/api/rooms', (req, res)=>{
  const name = req.body.name || 'Player'
  const roomId = engine.createRoom(name)
  res.json({roomId})
})

app.post('/api/rooms/:roomId/join', (req,res)=>{
  const roomId = req.params.roomId
  const name = req.body.name || 'Player'
  const ok = engine.joinRoom(roomId, name)
  if(ok) res.status(200).send({ok:true})
  else res.status(404).send({ok:false})
})

app.post('/api/rooms/:roomId/add-ai', (req,res)=>{
  const roomId = req.params.roomId
  const level = req.body.level || 1
  engine.addAI(roomId, level)
  res.status(200).send({ok:true})
})

io.on('connection', socket=>{
  socket.on('room:subscribe', ({roomId})=>{
    socket.join(roomId)
  })
  socket.on('room:unsubscribe', ({roomId})=>{
    socket.leave(roomId)
  })
})

const PORT = process.env.PORT || 8080
server.listen(PORT, ()=>console.log('Server listening on', PORT))
