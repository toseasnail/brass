import React from 'react'
import Lobby from './pages/Lobby'
import GameRoom from './pages/GameRoom'

export default function App(){
  const [route, setRoute] = React.useState<'lobby'|'game'>('lobby')
  const [roomId, setRoomId] = React.useState<string | null>(null)

  return (
    <div className="app-root">
      {route === 'lobby' && <Lobby onJoin={(id)=>{setRoomId(id); setRoute('game')}}/>}
      {route === 'game' && roomId && <GameRoom roomId={roomId} onLeave={()=>{setRoute('lobby'); setRoomId(null)}} />}
    </div>
  )
}
