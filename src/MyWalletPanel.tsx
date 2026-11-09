import { useState } from 'react'

type Props = {
  onBet: (amount: number) => boolean
  bettingOpen: boolean
  currentBet: number
  demoBalance: number
  pendingClaims: { round: number; amount: number }[]
  onClaim: (round: number) => boolean
}

export default function MyWalletPanel({ onBet, bettingOpen, currentBet, demoBalance, pendingClaims, onClaim }: Props) {
  const [amount, setAmount] = useState('1')
  const [notice, setNotice] = useState('')
  const parsed = Number(amount)
  const valid = Number.isSafeInteger(parsed) && parsed > 0 && parsed <= demoBalance

  function handleBet() {
    if (!valid || !bettingOpen) return
    setNotice(onBet(parsed)
      ? `Simulated bet: ${parsed} GC. No tokens transferred.`
      : 'Could not add demo bet. Check virtual balance or player limit.')
  }

  return (
    <section style={{ maxWidth: 440, margin: '24px auto', padding: 20,
      border: '1px solid #ddd', borderRadius: 14, background: '#fff',
      color: '#29243e', textAlign: 'left' }}>
      <h2 style={{ marginTop: 0 }}>MY WALLET — DEMO</h2>
      <p style={{ fontSize: 13, color: '#777' }}>
        Wallet-themed simulation. Your real Gamecoin balance is not spent.
      </p>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '14px 0 6px' }}>
        <span style={{ fontSize: 14, color: '#555' }}>Demo balance</span>
        <strong style={{ fontSize: 25, color: '#29243e' }}>{demoBalance.toLocaleString('en-US')} GC</strong>
      </div>
      <p>My current demo bet: <b>{currentBet} GC</b></p>
      <label htmlFor="demo-bet" style={{ display: 'block', marginBottom: 8 }}>
        Demo bet amount (whole GC)
      </label>
      <div style={{ display: 'flex', gap: 8 }}>
        <input id="demo-bet" type="number" min="1" step="1" value={amount}
          onChange={e => { setAmount(e.target.value); setNotice('') }}
          style={{ flex: 1, minWidth: 0, padding: 10, border: '1px solid #ccc', borderRadius: 8 }} />
        <button type="button" disabled={!valid || !bettingOpen} onClick={handleBet}
          style={{ padding: '10px 16px', border: 0, borderRadius: 8,
            background: valid && bettingOpen ? '#6654d9' : '#aaa', color: 'white' }}>
          BET {amount || '0'} GC
        </button>
      </div>
      {parsed > demoBalance && <p style={{ color: '#b42318', fontSize: 12, marginBottom: 0 }}>Not enough demo GC for this bet.</p>}
      {notice && <p role="status" style={{ color: '#16865c', fontWeight: 600 }}>{notice}</p>}
      <p style={{ fontSize: 12, color: '#888' }}>
        Simulation only. CLAIM credits demo GC, not real Gamecoin. No Miden Note is created or sent.
      </p>
      {pendingClaims.length === 0 ? (
  <button type="button" disabled style={{ padding: "10px 16px", borderRadius: 8 }}>CLAIM WINNINGS</button>
) : pendingClaims.map(claim => (
  <button key={claim.round} type="button" onClick={() => {
    setNotice(onClaim(claim.round) ? `Claimed ${claim.amount} demo GC from round #${claim.round}.` : "CLAIM failed.")
  }} style={{ padding: "10px 16px", marginRight: 6, borderRadius: 8, cursor: "pointer" }}>
    CLAIM {claim.amount} GC — ROUND #{claim.round}
  </button>
))}
    </section>
  )
}
