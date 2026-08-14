import { Server } from 'socket.io'
import { GameState, Player } from './types'

export class GameEngine {
  io: Server
  rooms: Map<string, GameState>

  constructor(io: Server){
    this.io = io
    this.rooms = new Map()
  }

  createRoom(creatorName:string){
    const id = Math.random().toString(36).slice(2,9)
    const state: GameState = {
      id,
      players: [{id: Math.random().toString(36).slice(2,8), name: creatorName, isAI:false}],
      phase: 'lobby',
      log: []
    }
    this.rooms.set(id, state)
    return id
  }

  joinRoom(roomId:string, name:string){
    const state = this.rooms.get(roomId)
    if(!state) return false
    state.players.push({id: Math.random().toString(36).slice(2,8), name, isAI:false})
    this.io.to(roomId).emit('game:state', state)
    return true
  }

  addAI(roomId:string, level:number){
    const state = this.rooms.get(roomId)
    if(!state) return
    const aiPlayer: Player = {id: Math.random().toString(36).slice(2,8), name:`AI-${level}`, isAI:true, aiLevel: level}
    state.players.push(aiPlayer)
    this.io.to(roomId).emit('game:log', `AI ${aiPlayer.name} sat at level ${level}`)
    this.io.to(roomId).emit('game:state', state)
    // For now do not run AI loop; will be implemented in next steps
  }
}
