mport { Server } from 'socket.io'
import {
  GameState,
  Player,
  Action,
  Board,
  City,
  Link,
  Market,
  Bank
} from './types'
import { decideAction } from '../ai/ai'

function randId(prefix = '') {
  return prefix + Math.random().toString(36).slice(2, 9)
}

// Simple helper to rotate turn index
function nextIndex(current: number, length: number) {
  return (current + 1) % length
}

export class GameEngine {
  io: Server
  rooms: Map<string, GameState>
  // AI timers so we can cancel if needed
  aiTimers: Map<string, NodeJS.Timeout[]>

  constructor(io: Server) {
    this.io = io
    this.rooms = new Map()
    this.aiTimers = new Map()
  }

  createRoom(creatorName: string) {
    const id = randId('r-')
    const player: Player = {
      id: randId('p-'),
      name: creatorName,
      isAI: false,
      money: 30,
      score: 0
    }
    const board: Board = { cities: {}, links: [] }
    // Minimal city graph (placeholder) — extend later to real map
    const cA: City = { id: 'A', name: 'A', links: ['B'], built: [] }
    const cB: City = { id: 'B', name: 'B', links: ['A', 'C'], built: [] }
    const cC: City = { id: 'C', name: 'C', links: ['B'], built: [] }
    board.cities[cA.id] = cA
    board.cities[cB.id] = cB
    board.cities[cC.id] = cC

    const state: GameState = {
      id,
      players: [player],
      phase: 'lobby',
      round: 0,
      turnIndex: 0,
      currentPlayerId: undefined,
      board,
      market: { coal: 10, iron: 10 },
      bank: { loans: {} },
      deck: { industry: [], link: [] },
      log: []
    }
    this.rooms.set(id, state)
    this.aiTimers.set(id, [])
    return id
  }

  joinRoom(roomId: string, name: string) {
    const state = this.rooms.get(roomId)
    if (!state) return false
    if (state.phase !== 'lobby') return false
    const newPlayer: Player = {
      id: randId('p-'),
      name,
      isAI: false,
      money: 30,
      score: 0
    }
    state.players.push(newPlayer)
    this.io.to(roomId).emit('game:state', this.publicState(state))
    state.log.push(`${name} joined`)
    return true
  }

  // Add AI player with level; if game already playing, AI will participate immediately
  addAI(roomId: string, level: number) {
    const state = this.rooms.get(roomId)
    if (!state) return
    const aiPlayer: Player = {
      id: randId('p-'),
      name: `AI-${level}`,
      isAI: true,
      aiLevel: level,
      money: 30,
      score: 0
    }
    state.players.push(aiPlayer)
    state.log.push(`AI ${aiPlayer.name} (level ${level}) joined`)
    this.io.to(roomId).emit('game:log', `AI ${aiPlayer.name} sat at level ${level}`)
    this.io.to(roomId).emit('game:state', this.publicState(state))
    // If game is playing and it's AI's turn, ensure execution will happen in turn loop
  }

  // Start the game if in lobby and enough players (2-4 typical)
  startGame(roomId: string) {
    const state = this.rooms.get(roomId)
    if (!state) return false
    if (state.phase !== 'lobby') return false
    state.phase = 'setup'
    state.round = 1
    state.turnIndex = 0
    state.currentPlayerId = state.players[state.turnIndex].id
    state.log.push('Game started')
    this.io.to(roomId).emit('game:state', this.publicState(state))
    // Begin first player's turn
    this.startTurn(roomId)
    return true
  }

  startTurn(roomId: string) {
    const state = this.rooms.get(roomId)
    if (!state) return
    if (state.players.length === 0) return
    state.phase = 'playing'
    const player = state.players[state.turnIndex]
    state.currentPlayerId = player.id
    state.log.push(`Turn start: ${player.name}`)
    this.io.to(roomId).emit('game:turn:start', { playerId: player.id, playerName: player.name })
    this.io.to(roomId).emit('game:state', this.publicState(state))

    // If AI, schedule AI decision(s)
    if (player.isAI) {
      this.scheduleAIMove(roomId, player)
    }
  }

  // Accepts an action from a client (or from internal AI call)
  async performAction(roomId: string, playerId: string, action: Action) {
    const state = this.rooms.get(roomId)
    if (!state) return { ok: false, reason: 'no room' }
    if (state.currentPlayerId !== playerId) return { ok: false, reason: 'not your turn' }
    const player = state.players.find(p => p.id === playerId)
    if (!player) return { ok: false, reason: 'player not found' }

    // Basic action handling
    switch (action.type) {
      case 'pass':
        state.log.push(`${player.name} passes`)
        break
      case 'build':
        // Very simplified build: deduct fixed cost, add building tag to first city possible
        const cost = 6
        if ((player.money ?? 0) < cost) {
          return { ok: false, reason: 'not enough money' }
        }
        player.money = (player.money ?? 0) - cost
        // find first city without that building
        const city = Object.values(state.board.cities).find(c => !c.built.includes(action.target))
        if (city) {
          city.built.push(action.target)
          state.log.push(`${player.name} builds ${action.target} in ${city.name}`)
          player.score = (player.score ?? 0) + 1
        } else {
          state.log.push(`${player.name} attempted build but no city available`)
        }
        break
      case 'take_loan':
        const amt = action.amount
        player.money = (player.money ?? 0) + amt
        state.bank.loans[playerId] = (state.bank.loans[playerId] ?? 0) + amt
        state.log.push(`${player.name} takes loan ${amt}`)
        break
      case 'end_turn':
        state.log.push(`${player.name} ends turn`)
        this.endTurn(roomId)
        break
      default:
        return { ok: false, reason: 'unknown action' }
    }

    this.io.to(roomId).emit('game:state', this.publicState(state))
    return { ok: true }
  }

  endTurn(roomId: string) {
    const state = this.rooms.get(roomId)
    if (!state) return
    // Cancel any pending AI timers for safety
    const timers = this.aiTimers.get(roomId) || []
    timers.forEach(t => clearTimeout(t))
    this.aiTimers.set(roomId, [])

    // Next player
    state.turnIndex = nextIndex(state.turnIndex, state.players.length)
    // If we wrapped to index 0, advance round
    if (state.turnIndex === 0) state.round += 1

    // Check for end condition (example: after 8 rounds)
    if (state.round > 8) {
      state.phase = 'finished'
      state.log.push('Game finished — calculating scores')
      this.calculateFinalScores(state)
      this.io.to(roomId).emit('game:state', this.publicState(state))
      this.io.to(roomId).emit('game:finished', { scores: state.players.map(p => ({ id: p.id, name: p.name, score: p.score })) })
      return
    }

    // Start next turn
    this.startTurn(roomId)
  }

  // Very simple score calculation placeholder
  calculateFinalScores(state: GameState) {
    // e.g., money + score
    state.players.forEach(p => {
      p.score = (p.score ?? 0) + (p.money ?? 0) / 10
    })
    state.log.push('Scores computed')
  }

  // Schedules AI decisions with a small delay depending on AI level
  scheduleAIMove(roomId: string, aiPlayer: Player) {
    const level = aiPlayer.aiLevel ?? 1
    const thinkMs = Math.min(5000, 500 + level * 1000)
    const t = setTimeout(async () => {
      const state = this.rooms.get(roomId)
      if (!state) return
      // Decide action using AI module
      const action = await decideAction(this.publicState(state), level)
      // If decideAction returns end_turn-like, call endTurn, else perform action
      if (action.type === 'end_turn' || action.type === 'pass') {
        await this.performAction(roomId, aiPlayer.id, { type: 'pass' })
        // End turn after small delay
        setTimeout(() => this.endTurn(roomId), 300)
      } else {
        await this.performAction(roomId, aiPlayer.id, action as Action)
        // End turn automatically after action for simplicity
        setTimeout(() => this.endTurn(roomId), 500)
      }
    }, thinkMs)

    const timers = this.aiTimers.get(roomId) || []
    timers.push(t)
    this.aiTimers.set(roomId, timers)
  }

  // Return a trimmed public state to broadcast (avoid sending function refs)
  publicState(state: GameState) {
    // shallow clone minimal fields for broadcast
    return {
      id: state.id,
      players: state.players.map(p => ({ id: p.id, name: p.name, isAI: p.isAI, money: p.money, score: p.score })),
      phase: state.phase,
      round: state.round,
      turnIndex: state.turnIndex,
      currentPlayerId: state.currentPlayerId,
      board: state.board,
      market: state.market,
      bank: state.bank,
      log: state.log.slice(-50)
    }
  }

  // Helper to receive socket events from server integration
  attachSocketHandlers() {
    this.io.on('connection', socket => {
      socket.on('engine:performAction', async ({ roomId, playerId, action }) => {
        const res = await this.performAction(roomId, playerId, action)
        socket.emit('engine:actionResult', res)
      })

      socket.on('engine:startGame', ({ roomId }) => {
        const ok = this.startGame(roomId)
        socket.emit('engine:startResult', { ok })
      })
    })
  }
}
