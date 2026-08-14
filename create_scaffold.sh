-- BEGIN SCRIPT -- #!/usr/bin/env bash set -euo pipefail

BRANCH="online-prototype"

echo "Creating branch ${BRANCH}..." git checkout -b ${BRANCH} || { echo "Branch exists or checkout failed"; git checkout ${BRANCH}; }

echo "Creating scaffold files..."

frontend package.json
mkdir -p frontend/src cat > frontend/package.json <<'EOF' { "name": "brass-frontend", "version": "0.1.0", "private": true, "scripts": { "dev": "vite", "build": "vite build", "preview": "vite preview" }, "dependencies": { "react": "^18.2.0", "react-dom": "^18.2.0", "socket.io-client": "^4.7.2", "i18next": "^23.0.1", "react-i18next": "^13.0.1" }, "devDependencies": { "typescript": "^5.1.6", "vite": "^5.1.0", "@vitejs/plugin-react": "^4.0.0" } } EOF

cat > frontend/vite.config.ts <<'EOF' import { defineConfig } from 'vite' import react from '@vitejs/plugin-react'

export default defineConfig({ plugins: [react()], server: { port: 3000 } }) EOF

cat > frontend/tsconfig.json <<'EOF' { "compilerOptions": { "target": "ES2020", "useDefineForClassFields": true, "lib": ["DOM", "ES2020"], "module": "ESNext", "moduleResolution": "Node", "jsx": "react-jsx", "strict": true, "esModuleInterop": true, "skipLibCheck": true }, "include": ["src"] } EOF

cat > frontend/src/main.tsx <<'EOF' import React from 'react' import { createRoot } from 'react-dom/client' import App from './App' import './styles.css'

createRoot(document.getElementById('root')!).render( <React.StrictMode> <App /> </React.StrictMode> ) EOF

cat > frontend/src/App.tsx <<'EOF' import React from 'react' import Lobby from './pages/Lobby' import GameRoom from './pages/GameRoom'

export default function App(){ const [route, setRoute] = React.useState<'lobby'|'game'>('lobby') const [roomId, setRoomId] = React.useState<string | null>(null)

return ( <div className="app-root"> {route === 'lobby' && <Lobby onJoin={(id)=>{setRoomId(id); setRoute('game')}}/>} {route === 'game' && roomId && <GameRoom roomId={roomId} onLeave={()=>{setRoute('lobby'); setRoomId(null)}} />} </div> ) } EOF

mkdir -p frontend/src/pages cat > frontend/src/pages/Lobby.tsx <<'EOF' import React from 'react' import { io } from '../lib/socket'

export default function Lobby({onJoin}:{onJoin:(roomId:string)=>void}){ const [name, setName] = React.useState('Player') const [room, setRoom] = React.useState('')

const createRoom = async ()=>{ const res = await fetch('/api/rooms', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name})}) const json = await res.json() onJoin(json.roomId) }

const joinRoom = async ()=>{ const res = await fetch(/api/rooms/${room}/join, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name})}) if(res.ok) onJoin(room) else alert('Failed to join') }

return ( <div className="lobby"> <h1>Brass: Birmingham — Online Prototype</h1> <label>Nickname</label> <input value={name} onChange={e=>setName(e.target.value)} /> <div className="actions"> <button onClick={createRoom}>Create Room</button> </div> <hr /> <label>Join by Room ID</label> <input value={room} onChange={e=>setRoom(e.target.value)} /> <button onClick={joinRoom}>Join</button> </div> ) } EOF

cat > frontend/src/pages/GameRoom.tsx <<'EOF' import React from 'react' import { socket } from '../lib/socket'

export default function GameRoom({roomId, onLeave}:{roomId:string, onLeave:()=>void}){ const [log, setLog] = React.useState<string[]>([]) const [state, setState] = React.useState<any>(null)

React.useEffect(()=>{ socket.emit('room:subscribe', {roomId}) socket.on('game:state', (s:any)=> setState(s)) socket.on('game:log', (msg:string)=> setLog(l=>[...l, msg])) return ()=>{ socket.emit('room:unsubscribe', {roomId}) socket.off('game:state') socket.off('game:log') } },[roomId])

const sitAI = async (level:number)=>{ await fetch(/api/rooms/${roomId}/add-ai, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({level})}) }

return ( <div className="game-room"> <h2>Room {roomId}</h2> <button onClick={onLeave}>Leave</button> <div className="game-state"> <pre>{JSON.stringify(state, null, 2)}</pre> </div> <div className="controls"> <button onClick={()=>sitAI(1)}>Add AI (Easy)</button> <button onClick={()=>sitAI(2)}>Add AI (Medium)</button> <button onClick={()=>sitAI(3)}>Add AI (Hard)</button> </div> <div className="log"> <h3>Log</h3> <ul>{log.map((l,i)=><li key={i}>{l}</li>)}</ul> </div> </div> ) } EOF

mkdir -p frontend/src/lib cat > frontend/src/lib/socket.ts <<'EOF' import { io } from 'socket.io-client'

const URL = (import.meta.env.VITE_SERVER_URL) || '' export const socket = io(URL, {autoConnect:true}) export default socket EOF

cat > frontend/src/styles.css <<'EOF' body { font-family: Arial, sans-serif; margin: 16px; } .lobby, .game-room { max-width: 900px; margin: 0 auto; } EOF

backend
mkdir -p backend/src/game-engine backend/src/ai backend/prisma

cat > backend/package.json <<'EOF' { "name": "brass-backend", "version": "0.1.0", "private": true, "main": "dist/server.js", "scripts": { "dev": "ts-node-dev --respawn src/server.ts", "build": "tsc -p .", "start": "node dist/server.js" }, "dependencies": { "express": "^4.18.2", "socket.io": "^4.7.2", "cors": "^2.8.5", "prisma": "^5.1.1" }, "devDependencies": { "typescript": "^5.1.6", "ts-node-dev": "^2.0.0" } } EOF

cat > backend/tsconfig.json <<'EOF' { "compilerOptions": { "target": "ES2020", "module": "CommonJS", "outDir": "dist", "rootDir": "src", "strict": true, "esModuleInterop": true, "skipLibCheck": true }, "include": ["src"] } EOF

cat > backend/src/server.ts <<'EOF' import express from 'express' import http from 'http' import { Server } from 'socket.io' import cors from 'cors' import { GameEngine } from './game-engine/engine'

const app = express() app.use(cors()) app.use(express.json())

const server = http.createServer(app) const io = new Server(server, {cors:{origin:'*'}})

const engine = new GameEngine(io)

// Simple rooms API app.post('/api/rooms', (req, res)=>{ const name = req.body.name || 'Player' const roomId = engine.createRoom(name) res.json({roomId}) })

app.post('/api/rooms/:roomId/join', (req,res)=>{ const roomId = req.params.roomId const name = req.body.name || 'Player' const ok = engine.joinRoom(roomId, name) if(ok) res.status(200).send({ok:true}) else res.status(404).send({ok:false}) })

app.post('/api/rooms/:roomId/add-ai', (req,res)=>{ const roomId = req.params.roomId const level = req.body.level || 1 engine.addAI(roomId, level) res.status(200).send({ok:true}) })

io.on('connection', socket=>{ socket.on('room:subscribe', ({roomId})=>{ socket.join(roomId) }) socket.on('room:unsubscribe', ({roomId})=>{ socket.leave(roomId) }) })

const PORT = process.env.PORT || 8080 server.listen(PORT, ()=>console.log('Server listening on', PORT)) EOF

cat > backend/src/game-engine/types.ts <<'EOF' export type Player = { id: string name: string isAI: boolean aiLevel?: number }

export type GameState = { id: string players: Player[] phase: 'lobby' | 'setup' | 'playing' | 'finished' // Minimal state for scaffold; full Brass rules will use board, market, tracks, links etc. log: string[] } EOF

cat > backend/src/game-engine/engine.ts <<'EOF' import { Server } from 'socket.io' import { GameState, Player } from './types'

export class GameEngine { io: Server rooms: Map<string, GameState>

constructor(io: Server){ this.io = io this.rooms = new Map() }

createRoom(creatorName:string){ const id = Math.random().toString(36).slice(2,9) const state: GameState = { id, players: [{id: Math.random().toString(36).slice(2,8), name: creatorName, isAI:false}], phase: 'lobby', log: [] } this.rooms.set(id, state) return id }

joinRoom(roomId:string, name:string){ const state = this.rooms.get(roomId) if(!state) return false state.players.push({id: Math.random().toString(36).slice(2,8), name, isAI:false}) this.io.to(roomId).emit('game:state', state) return true }

addAI(roomId:string, level:number){ const state = this.rooms.get(roomId) if(!state) return const aiPlayer: Player = {id: Math.random().toString(36).slice(2,8), name:AI-${level}, isAI:true, aiLevel: level} state.players.push(aiPlayer) this.io.to(roomId).emit('game:log', AI ${aiPlayer.name} sat at level ${level}) this.io.to(roomId).emit('game:state', state) // For now do not run AI loop; will be implemented in next steps } } EOF

cat > backend/src/ai/ai.ts <<'EOF' // AI stubs — different levels will use different policies export async function decideAction(state:any, aiLevel:number){ // Level 1: random (fast) // Level 2: rule-based heuristics // Level 3: deeper search (placeholder for MCTS/minimax) if(aiLevel === 1){ return {type:'pass'} } if(aiLevel === 2){ return {type:'build', target:'coal-plant'} } return {type:'build', target:'industry'} } EOF

cat > backend/prisma/schema.prisma <<'EOF' generator client { provider = "prisma-client-js" }

datasource db { provider = "postgresql" url = env("DATABASE_URL") }

model Room { id String @id state Json createdAt DateTime @default(now()) } EOF

cat > docker-compose.yml <<'EOF' version: '3.8' services: db: image: postgres:15 environment: POSTGRES_USER: dev POSTGRES_PASSWORD: dev POSTGRES_DB: brass_dev ports: - '5432:5432' volumes: - db-data:/var/lib/postgresql/data

volumes: db-data: EOF

mkdir -p .github/workflows cat > .github/workflows/ci.yml <<'EOF' name: CI on: [push, pull_request]

jobs: build: runs-on: ubuntu-latest steps: - uses: actions/checkout@v4 - name: Setup Node uses: actions/setup-node@v4 with: node-version: '18' - name: Install frontend deps run: | cd frontend npm ci - name: Build frontend run: | cd frontend npm run build - name: Install backend deps run: | cd backend npm ci - name: Typecheck backend run: | cd backend npx tsc -p . EOF

README update
cat > README.md <<'EOF'

Brass: Birmingham - Online Prototype
This repository will host an online implementation of the board game "Brass: Birmingham" (prototype).

Goals:

Server-authoritative online multiplayer implementation (real-time) with AI players.
Exact game rules implementation.
Public access: anyone can join games.
Non-commercial, community-hosted on user's server.
Workflow:

Create `online-prototype` branch with initial scaffold (frontend + backend).
Implement server-side game engine and AI.
Connect frontend (React) to backend (Node/Express + Socket.io).
Add persistence (PostgreSQL) and deployment instructions.
Note: This project contains no original artwork from the published game; use only original or freely licensed assets. EOF

echo "Staging files..." git add . git commit -m "chore: scaffold frontend + backend + game-engine stub" || true

echo "Attempting to push branch to origin..." if git rev-parse --abbrev-ref @{u} >/dev/null 2>&1; then git push -u origin ${BRANCH} else echo "No upstream configured for this branch; attempting to push..." git push -u origin ${BRANCH} || echo "Push failed — you likely don't have permission. Local changes committed on branch ${BRANCH}." fi

echo "Done. If push failed due to permissions, please push manually or grant write access." -- END SCRIPT --
