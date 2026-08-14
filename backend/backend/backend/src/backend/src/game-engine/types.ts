export type Player = {
  id: string
  name: string
  isAI: boolean
  aiLevel?: number
}

export type GameState = {
  id: string
  players: Player[]
  phase: 'lobby' | 'setup' | 'playing' | 'finished'
  // Minimal state for scaffold; full Brass rules will use board, market, tracks, links etc.
  log: string[]
}
