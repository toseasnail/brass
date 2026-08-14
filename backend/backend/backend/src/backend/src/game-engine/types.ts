export type Player = {
  id: string
  name: string
  isAI: boolean
  aiLevel?: number
  money?: number
  score?: number
}

export type Action =
  | { type: 'pass' }
  | { type: 'build'; target: string }
  | { type: 'take_loan'; amount: number }
  | { type: 'end_turn' }

export type City = {
  id: string
  name: string
  links: string[]
  built: string[] // list of building types built in this city
}

export type Link = {
  from: string
  to: string
  owner?: string // player id if built
}

export type Board = {
  cities: Record<string, City>
  links: Link[]
}

export type Market = {
  coal: number
  iron: number
}

export type Bank = {
  loans: Record<string, number> // playerId -> loans taken
}

export type GameState = {
  id: string
  players: Player[]
  phase: 'lobby' | 'setup' | 'playing' | 'finished'
  round: number
  turnIndex: number
  currentPlayerId?: string
  board: Board
  market: Market
  bank: Bank
  // Minimal placeholders for deck/tiles/market
  deck: {
    industry: string[]
    link: string[]
  }
  log: string[]
}
