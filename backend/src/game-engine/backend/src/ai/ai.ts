// AI policies: level 1 random, level 2 heuristic, level 3 (placeholder) deeper planning

type PublicState = any

export async function decideAction(state: PublicState, aiLevel: number) {
  // Level 1: random pass/build or take small loan if low on cash
  if (aiLevel === 1) {
    const me = findSelf(state)
    if (!me) return { type: 'pass' }
    if ((me.money ?? 0) < 5) return { type: 'take_loan', amount: 6 }
    // random choice
    const r = Math.random()
    if (r < 0.5) return { type: 'pass' }
    return { type: 'build', target: 'industry' }
  }

  // Level 2: simple heuristic
  if (aiLevel === 2) {
    const me = findSelf(state)
    if (!me) return { type: 'pass' }
    // If lots of money, try to build; if low, take loan
    if ((me.money ?? 0) < 8) {
      return { type: 'take_loan', amount: 8 }
    }
    // Prefer to build where few buildings exist
    return { type: 'build', target: 'industry' }
  }

  // Level 3: placeholder - could be MCTS/expectimax (expensive)
  // For now act like level 2 but think longer
  await sleep(500)
  return decideAction(state, 2)
}

function findSelf(state: PublicState) {
  if (!state || !state.players) return null
  // AI name pattern: caller's environment should pass player id; for simplicity choose first AI
  return state.players.find((p: any) => p.isAI) || state.players[0]
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
