import { useEffect, useRef, useState } from 'react'
import './App.css'

type Player = { id: number; name: string; balance: number; bet: number; color: string }
type Phase = 'betting' | 'spinning' | 'result'
type HistoryItem = { round: number; winner: string; amount: number; status: 'paid' | 'cancelled' }
type SavedGame = { players: Player[]; round: number; nextId: number; history: HistoryItem[]; deadline: number; phase?: Phase }

const BETTING_SECONDS = 120
const SPIN_SECONDS = 6
const RESULT_SECONDS = 5
const START_BALANCE = 1000
const STORAGE_KEY = 'bread-wheel-demo-v2'
const colors = ['#ef7558', '#6c60d9', '#26b5a1', '#e9a23b', '#e66da8', '#3498db', '#a0b84b', '#a779d5', '#d76c58', '#42a6a0']

function loadGame(): SavedGame {
  const fresh: SavedGame = { players: [], round: 1, nextId: 1, history: [], deadline: Date.now() + BETTING_SECONDS * 1000, phase: 'betting' }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return fresh
    const saved = JSON.parse(raw) as SavedGame
    if (!Array.isArray(saved.players) || !Array.isArray(saved.history) || !Number.isSafeInteger(saved.round)) return fresh
    const players = saved.players.filter(p => Number.isSafeInteger(p.id) && typeof p.name === 'string' && Number.isSafeInteger(p.balance) && p.balance >= 0 && Number.isSafeInteger(p.bet) && p.bet >= 0 && typeof p.color === 'string')
    return { players: saved.phase === 'result' ? players.map(p => ({ ...p, bet: 0 })) : players, round: Math.max(1, saved.round) + (saved.phase === 'result' ? 1 : 0), nextId: Number.isSafeInteger(saved.nextId) ? Math.max(saved.nextId, ...players.map(p => p.id + 1), 1) : 1, history: saved.history, deadline: saved.phase === 'result' ? fresh.deadline : Number.isFinite(saved.deadline) ? saved.deadline : fresh.deadline }
  } catch { return fresh }
}

function getSegments(players: Player[]) {
  const active = players.filter(p => p.bet > 0)
  const total = active.reduce((sum, p) => sum + p.bet, 0)
  let currentAngle = -90
  return active.map(player => {
    const angle = (player.bet / total) * 360
    const startAngle = currentAngle
    currentAngle += angle
    const point = (degrees: number) => {
      const rad = degrees * Math.PI / 180
      return { x: 180 + 165 * Math.cos(rad), y: 180 + 165 * Math.sin(rad) }
    }
    const start = point(startAngle)
    const end = point(startAngle + angle)
    const path = angle >= 359.999
      ? 'M 180 180 L 180 15 A 165 165 0 1 1 180 345 A 165 165 0 1 1 180 15 Z'
      : `M 180 180 L ${start.x} ${start.y} A 165 165 0 ${angle > 180 ? 1 : 0} 1 ${end.x} ${end.y} Z`
    return { ...player, angle, startAngle, path }
  })
}

function App() {
  const [initial] = useState(loadGame)
  const [players, setPlayers] = useState<Player[]>(initial.players)
  const [round, setRound] = useState(initial.round)
  const [nextId, setNextId] = useState(initial.nextId)
  const [history, setHistory] = useState<HistoryItem[]>(initial.history)
  const [deadline, setDeadline] = useState(initial.deadline)
  const [phase, setPhase] = useState<Phase>('betting')
  const [timeLeft, setTimeLeft] = useState(Math.max(0, Math.ceil((initial.deadline - Date.now()) / 1000)))
  const [rotation, setRotation] = useState(0)
  const [winner, setWinner] = useState<Player | null>(null)
  const [message, setMessage] = useState('')
  const [newName, setNewName] = useState('')
  const [newCoins, setNewCoins] = useState('10')
  const [betInputs, setBetInputs] = useState<Record<number, string>>({})
  const playersRef = useRef(players)
  const phaseRef = useRef<Phase>('betting')
  const spinningRef = useRef(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const resultTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  playersRef.current = players

  const totalPot = players.reduce((sum, p) => sum + p.bet, 0)
  const segments = getSegments(players)
  const activeCount = segments.length

  useEffect(() => {
    const data: SavedGame = { players, round, nextId, history, deadline, phase }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }, [players, round, nextId, history, deadline, phase])

  function placeBet(id: number, amountText: string) {
    if (phaseRef.current !== 'betting') return
    const amount = Number(amountText)
    if (!Number.isSafeInteger(amount) || amount < 1) { alert('Enter a positive whole number of coins'); return }
    const player = playersRef.current.find(p => p.id === id)
    if (!player || amount > player.balance) { alert('Not enough coins in balance'); return }
    setPlayers(previous => previous.map(p => p.id === id ? { ...p, balance: p.balance - amount, bet: p.bet + amount } : p))
    setBetInputs(previous => ({ ...previous, [id]: '' }))
  }

  function addPlayer() {
    if (phaseRef.current !== 'betting') return
    if (playersRef.current.length >= 20) { alert('Maximum 20 players'); return }
    const name = newName.trim() || `Player ${nextId}`
    const id = nextId
    const player: Player = { id, name, balance: START_BALANCE, bet: 0, color: colors[(id - 1) % colors.length] }
    setPlayers(previous => [...previous, player])
    setNextId(previous => previous + 1)
    setNewName('')
    setNewCoins('10')
    const amount = Number(newCoins)
    if (Number.isSafeInteger(amount) && amount > 0 && amount <= START_BALANCE) {
      setPlayers(previous => previous.map(p => p.id === id ? { ...p, balance: START_BALANCE - amount, bet: amount } : p))
    }
  }

  function removePlayer(id: number) {
    if (phaseRef.current !== 'betting') return
    if (!window.confirm('Remove this player from the demo lobby? Their virtual balance and bet will be deleted.')) return
    setPlayers(previous => previous.filter(p => p.id !== id))
  }

  function finishRound() {
    phaseRef.current = 'result'
    setPhase('result')
    resultTimeoutRef.current = setTimeout(() => {
      setPlayers(previous => previous.map(p => ({ ...p, bet: 0 })))
      setRotation(0)
      setWinner(null)
      setMessage('')
      setRound(previous => previous + 1)
      const nextDeadline = Date.now() + BETTING_SECONDS * 1000
      setDeadline(nextDeadline)
      setTimeLeft(BETTING_SECONDS)
      spinningRef.current = false
      phaseRef.current = 'betting'
      setPhase('betting')
    }, RESULT_SECONDS * 1000)
  }

  function startSpin() {
    if (spinningRef.current) return
    spinningRef.current = true
    phaseRef.current = 'spinning'
    setPhase('spinning')
    setTimeLeft(0)
    const currentPlayers = playersRef.current
    const currentRound = round
    const active = currentPlayers.filter(p => p.bet > 0)
    const total = active.reduce((sum, p) => sum + p.bet, 0)

    if (active.length < 2 || total <= 0) {
      setPlayers(previous => previous.map(p => ({ ...p, balance: p.balance + p.bet, bet: 0 })))
      setMessage('Round cancelled — bets refunded (at least 2 bettors required)')
      setHistory(previous => [{ round: currentRound, winner: 'No winner', amount: 0, status: 'cancelled' }, ...previous].slice(0, 50))
      finishRound()
      return
    }

    const currentSegments = getSegments(currentPlayers)
    const random = Math.random() * total
    let cumulative = 0
    let selectedIndex = active.length - 1
    for (let i = 0; i < active.length; i++) {
      cumulative += active[i].bet
      if (random < cumulative) { selectedIndex = i; break }
    }
    const selected = currentSegments[selectedIndex]
    const margin = Math.min(5, selected.angle * 0.1)
    const stopAngle = selected.startAngle + margin + Math.random() * Math.max(0, selected.angle - margin * 2)
    const targetAngle = -90 - stopAngle
    setRotation(previous => {
      const current = ((previous % 360) + 360) % 360
      const offset = ((targetAngle - current) % 360 + 360) % 360
      return previous + 360 * 7 + offset
    })

    timeoutRef.current = setTimeout(() => {
      setPlayers(previous => previous.map(p => p.id === selected.id ? { ...p, balance: p.balance + total } : p))
      setWinner(selected)
      setMessage(`${selected.name} wins ${total} coins!`)
      setHistory(previous => [{ round: currentRound, winner: selected.name, amount: total, status: 'paid' }, ...previous].slice(0, 50))
      finishRound()
    }, SPIN_SECONDS * 1000)
  }

  useEffect(() => {
    const interval = setInterval(() => {
      if (phaseRef.current !== 'betting') return
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
      setTimeLeft(remaining)
      if (remaining === 0) startSpin()
    }, 200)
    return () => clearInterval(interval)
  }, [deadline])

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    if (resultTimeoutRef.current) clearTimeout(resultTimeoutRef.current)
  }, [])

  const formattedTime = `${String(Math.floor(timeLeft / 60)).padStart(2, '0')}:${String(timeLeft % 60).padStart(2, '0')}`

  return (
    <main className="game">
      <h1>BREAD WHEEL</h1>
      <h2>Free-for-All</h2>
      <div className="round-header">
        <span>ROUND #{round}</span>
        <span className={`phase phase-${phase}`}>{phase === 'betting' ? 'BETTING OPEN' : phase === 'spinning' ? 'SPINNING' : 'ROUND COMPLETE'}</span>
      </div>
      <div className={`timer ${timeLeft <= 15 && phase === 'betting' ? 'timer-warning' : ''}`}>
        {phase === 'betting' ? formattedTime : phase === 'spinning' ? 'DRAW IN PROGRESS' : 'NEXT ROUND SOON'}
      </div>
      <h3>Total Pot: {totalPot} coins</h3>
      <div className="wheel-container">
        <div className="pointer" />
        <svg className="wheel" viewBox="0 0 360 360" style={{ transform: `rotate(${rotation}deg)`, transition: phase === 'spinning' ? `transform ${SPIN_SECONDS}s cubic-bezier(0.12, 0.7, 0.12, 1)` : 'none' }}>
          {segments.map(segment => <path key={segment.id} d={segment.path} fill={segment.color} stroke="#ffffff" strokeWidth="2" />)}
        </svg>
        <div className="wheel-center" />
      </div>
      <div className="players">
        {players.map(player => (
          <div className="player" key={player.id} style={{ backgroundColor: player.color }}>
            <strong>{player.name}</strong>
            <div style={{ fontSize: 13, marginTop: 6 }}>Balance: <b>{player.balance}</b></div>
            <div style={{ fontSize: 13 }}>Bet: <b>{player.bet}</b> coins</div>
            <div className="player-percent">{totalPot > 0 ? ((player.bet / totalPot) * 100).toFixed(1) : '0.0'}%</div>
            {phase === 'betting' && <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginTop: 8 }}>
              <input aria-label={`Bet for ${player.name}`} type="number" min="1" max={player.balance} step="1" placeholder="Amount" value={betInputs[player.id] ?? ''} onChange={event => setBetInputs(previous => ({ ...previous, [player.id]: event.target.value }))} style={{ width: 65, minWidth: 0, padding: 4, borderRadius: 5, border: 'none' }} />
              <button disabled={player.balance < 1} onClick={() => placeBet(player.id, betInputs[player.id] ?? '')} style={{ borderRadius: 5, border: 'none', cursor: 'pointer', padding: '4px 7px' }}>Bet</button>
            </div>}
            <button className="remove-button" disabled={phase !== 'betting'} onClick={() => removePlayer(player.id)}>Remove</button>
          </div>
        ))}
      </div>
      {phase === 'betting' && <p className="status-text">Place your bets before the timer runs out! ({activeCount} bettors)</p>}
      {phase === 'spinning' && <p className="status-text">Bets are locked. Selecting the winner...</p>}
      {phase === 'result' && <h2 className="winner">{winner ? '🏆 ' : ''}{message}</h2>}
      <section className="lobby">
        <h2>Test Lobby</h2>
        <p>New players start with {START_BALANCE} virtual coins</p>
        <div className="add-player">
          <input type="text" placeholder="Player name" maxLength={24} value={newName} disabled={phase !== 'betting'} onChange={event => setNewName(event.target.value)} />
          <input type="number" min="1" max={START_BALANCE} step="1" placeholder="Initial bet" value={newCoins} disabled={phase !== 'betting'} onChange={event => setNewCoins(event.target.value)} />
          <button onClick={addPlayer} disabled={phase !== 'betting' || players.length >= 20}>+ Add Player</button>
        </div>
        <p className="demo-note">Local simulation only. No real wallet transactions. Balances and history are stored in this browser.</p>
      </section>
      <section className="history">
        <h2>Round History</h2>
        {history.length === 0 ? <p>No completed rounds yet.</p> : <div className="history-list">
          {history.slice(0, 10).map(item => <div className="history-item" key={item.round}><span>#{item.round}</span><strong>{item.winner}</strong><span>{item.status === 'paid' ? `${item.amount} coins` : 'Cancelled / Refunded'}</span></div>)}
        </div>}
      </section>
    </main>
  )
}

export default App
