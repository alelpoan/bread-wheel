import { useState } from 'react'
import { useMidenFiWallet } from '@miden-sdk/miden-wallet-adapter-react'
import { GC_UNIT, prepareStakeNote, type StakeDraft } from './StakeNoteDraft'

function formatGC(value: bigint): string {
  const whole = value / GC_UNIT
  const fraction = (value % GC_UNIT).toString().padStart(6, '0').replace(/0+$/, '')
  return fraction ? `${whole}.${fraction}` : `${whole}`
}

export default function RealStakePreview({ balanceBaseUnits }: { balanceBaseUnits: bigint | null }) {
  const { connected, address } = useMidenFiWallet()
  const [amount, setAmount] = useState('1')
  const [round, setRound] = useState('1')
  const [refundBlock, setRefundBlock] = useState('')
  const [draft, setDraft] = useState<StakeDraft | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function prepare() {
    setError('')
    setDraft(null)
    if (!connected || !address) return setError('Connect Bread Wallet first')
    if (balanceBaseUnits === null) return setError('Gamecoin balance not loaded')
    const n = Number(amount)
    if (!Number.isSafeInteger(n) || n < 1) return setError('Stake must be a positive whole number of GC')
    if (BigInt(n) * GC_UNIT > balanceBaseUnits) return setError('Not enough Gamecoin')
    setBusy(true)
    try {
      setDraft(await prepareStakeNote(address, n, Number(round), Number(refundBlock)))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section style={{ maxWidth: 440, margin: '24px auto', padding: 20, border: '1px solid #ddd', borderRadius: 14, background: '#fff', color: '#29243e', textAlign: 'left' }}>
      <h2 style={{ marginTop: 0 }}>REAL GAMECOIN — NOTE PREPARATION</h2>
      <p style={{ fontSize: 13, color: '#777' }}>Local construction only. No transaction, signature, token transfer, or lock. BET and REFUND are not enabled.</p>
      <p>Available: <b>{connected && balanceBaseUnits !== null ? `${formatGC(balanceBaseUnits)} GC` : 'Not loaded'}</b></p>
      <label htmlFor="stake-amount">Stake (whole GC)</label>
      <input id="stake-amount" type="number" min="1" step="1" value={amount} onChange={e => { setAmount(e.target.value); setDraft(null) }} style={{ display: 'block', boxSizing: 'border-box', width: '100%', padding: 10, margin: '6px 0 12px' }} />
      <label htmlFor="stake-round">Round ID (test value)</label>
      <input id="stake-round" type="number" min="0" step="1" value={round} onChange={e => { setRound(e.target.value); setDraft(null) }} style={{ display: 'block', boxSizing: 'border-box', width: '100%', padding: 10, margin: '6px 0 12px' }} />
      <label htmlFor="stake-refund">Refund-after block (must be verified against current chain tip)</label>
      <input id="stake-refund" type="number" min="1" step="1" placeholder="Block number" value={refundBlock} onChange={e => { setRefundBlock(e.target.value); setDraft(null) }} style={{ display: 'block', boxSizing: 'border-box', width: '100%', padding: 10, margin: '6px 0 12px' }} />
      <button type="button" disabled={busy || !connected || balanceBaseUnits === null} onClick={() => void prepare()}>{busy ? 'PREPARING...' : 'PREPARE NOTE (NO TRANSACTION)'}</button>
      {error && <p role="alert" style={{ color: '#b42318', overflowWrap: 'anywhere' }}>{error}</p>}
      {draft && <div role="status" style={{ marginTop: 12, overflowWrap: 'anywhere', fontSize: 12 }}><strong>Local Note draft prepared</strong><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{JSON.stringify(draft, null, 2)}</pre></div>}
      <p style={{ fontSize: 12, color: '#777' }}>A compiled, tested stake-note.bin is required in public/. Until then preparation reports a safe error. Do not manually deploy the current prototype with real GC.</p>
    </section>
  )
}
