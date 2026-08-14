// AI stubs — different levels will use different policies
export async function decideAction(state:any, aiLevel:number){
  // Level 1: random (fast)
  // Level 2: rule-based heuristics
  // Level 3: deeper search (placeholder for MCTS/minimax)
  if(aiLevel === 1){
    return {type:'pass'}
  }
  if(aiLevel === 2){
    return {type:'build', target:'coal-plant'}
  }
  return {type:'build', target:'industry'}
}
