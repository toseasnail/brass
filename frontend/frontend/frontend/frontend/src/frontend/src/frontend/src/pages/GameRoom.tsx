import React from 'react'

export default function Lobby({onJoin}:{onJoin:(roomId:string)=>void}){
  const [name, setName] = React.useState('Player')
  const [room, setRoom] = React.useState('')

  const createRoom = async ()=>{
    const res = await fetch('/api/rooms', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name})})
    const json = await res.json()
    onJoin(json.roomId)
  }

  const joinRoom = async ()=>{
    const res = await fetch(`/api/rooms/${room}/join`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name})})
    if(res.ok) onJoin(room)
    else alert('Failed to join')
  }

  return (
    <div className="lobby">
      <h1>Brass: Birmingham — Online Prototype</h1>
      <label>Nickname</label>
      <input value={name} onChange={e=>setName(e.target.value)} />
      <div className="actions">
        <button onClick={createRoom}>Create Room</button>
      </div>
      <hr />
      <label>Join by Room ID</label>
      <input value={room} onChange={e=>setRoom(e.target.value)} />
      <button onClick={joinRoom}>Join</button>
    </div>
  )
}
