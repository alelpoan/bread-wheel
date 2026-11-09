import { useMemo, useState } from 'react'
import { formatGamecoin, summarizeRound, type RoundBet } from './RoundMath'

/** Read-only illustration. No onchain actions, no Math.random and no actual betting. */
export default function RoundRulesPreview() {
  const [a, setA] = useState('1')
  const [b, setB] = useState('0')
  const [c, setC] = useState('0')
  const { summary, error } = useMemo(() => {
    try {
      const bets: RoundBet[] = [a, b, c].flatMap((value, index) => {
        if (!/^\d+$/.test(value)) throw new Error('Enter whole GC amounts (0 or more)')
        const amount = BigInt(value)
        if (amount > 1_000_000n) throw new Error('Demo limit: 1,000,000 GC per player')
        return amount ? [{ account: `Player ${index + 1}`, amountBaseUnits: amount * 1_000_000n }] : []
      })
      return { summary: summarizeRound(bets), error: '' }
    } catch (e) {
      return { summary: null, error: e instanceof Error ? e.message : String(e) }
    }
  }, [a, b, c])
  return (
    <section style={{ margin: '16px 0', padding: 16, border: '1px solid #c7c3d3', borderRadius: 12, background: '#fff', color: '#29243e' }}>
      <h3 style={{ margin: '0 0 8px' }}>ROUND RULES — PREVIEW</h3>
      <p style={{ fontSize: 12, color: '#666' }}>Illustration only. No wallet requests, no real bets or payouts.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
        {[[a, setA], [b, setB], [c, setC]].map(([value, setter], i) => (
          <label key={i} style={{ fontSize: 12 }}>Player {i + 1} (GC)
            <input type="number" min="0" step="1" value={value as string} onChange={e => (setter as (v: string) => void)(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: 8, marginTop: 4 }} />
          </label>
        ))}
      </div>
      {error && <p role="alert" style={{ color: '#b42318' }}>{error}</p>}
      {summary && <>
        <p><b>Pool: {formatGamecoin(summary.totalBaseUnits)} GC</b> · Players: {summary.participantCount}</p>
        {summary.entries.map(entry => <p key={entry.account} style={{ margin: '5px 0', fontSize: 13 }}>{entry.account}: {formatGamecoin(entry.amountBaseUnits)} GC · {(entry.chanceBps / 100).toFixed(2)}% chance</p>)}
        <p style={{ fontSize: 13 }}>{!summary.canSpin ? 'No bets: skip the spin.' : summary.soleWinner ? `${summary.soleWinner} is the sole winner (100%) and gets their stake back.` : 'After 120 seconds: close betting, verify an unbiased draw, and pay the entire pool to the winner.'}</p>
      </>}
      <p style={{ fontSize: 11, color: '#777' }}>Winner selection and payouts are not implemented onchain. This preview does not provide randomness.</p>
    </section>
  )
}
