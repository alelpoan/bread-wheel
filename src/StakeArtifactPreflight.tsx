import { useState } from 'react'
import { useMidenFiWallet } from '@miden-sdk/miden-wallet-adapter-react'
import { buildStakeTransactionRequest } from './StakeTransactionRequest'
import type { StakeDraft } from './StakeNoteDraft'

const EXPECTED_SHA256 = '830cd8f890bc24b511dd0979ff7a62857fd2e71ed2f68ca2685918be26ed4617'

async function verifyArtifact(): Promise<string> {
  const response = await fetch('/stake-note.bin', { cache: 'no-store' })
  if (!response.ok) throw new Error(`stake-note.bin unavailable (HTTP ${response.status})`)
  const bytes = await response.arrayBuffer()
  if (bytes.byteLength !== 505) throw new Error(`Unexpected script size: ${bytes.byteLength} bytes`)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')
  if (hash !== EXPECTED_SHA256) throw new Error('Script SHA-256 differs from the approved GitHub artifact. Stop.')
  return hash
}

/** Builds an actual SDK TransactionRequest but never hands it to the wallet.
 * The present MASM script only supports an owner refund; no winner settlement.
 */
export default function StakeArtifactPreflight() {
  const wallet = useMidenFiWallet()
  const { connected, address } = wallet
  const [roundId, setRoundId] = useState('1')
  const [refundBlock, setRefundBlock] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<StakeDraft | null>(null)
  const [hash, setHash] = useState('')
  const [error, setError] = useState('')
  const walletHasRequestTransaction = 'requestTransaction' in wallet && typeof wallet.requestTransaction === 'function'

  async function prepare() {
    setBusy(true); setError(''); setResult(null); setHash('')
    try {
      if (!connected || !address) throw new Error('Connect Bread Wallet first.')
      const round = Number(roundId)
      const deadline = Number(refundBlock)
      if (!Number.isSafeInteger(round) || round < 0) throw new Error('Invalid round ID')
      if (!Number.isSafeInteger(deadline) || deadline < 1) throw new Error('Enter a verified future refund block. No block is guessed automatically.')
      const verifiedHash = await verifyArtifact()
      const { draft, request } = await buildStakeTransactionRequest(address, 1, round, deadline)
      if (!request) throw new Error('SDK did not create a transaction request.')
      setHash(verifiedHash)
      setResult(draft)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally { setBusy(false) }
  }

  return <section style={{ border: '1px solid #a6a6a6', borderRadius: 12, padding: 16, marginTop: 16, background: '#fff', color: '#222' }}>
    <h3 style={{ marginTop: 0 }}>MASM Note — transaction preparation</h3>
    <p style={{ fontSize: 13 }}>Verifies the compiled script and builds an actual SDK TransactionRequest for 1 GC. No transaction is signed, submitted, or sent to Bread Wallet.</p>
    <p style={{ fontSize: 12 }}>Wallet transaction API: {walletHasRequestTransaction ? 'requestTransaction available' : 'requestTransaction not exposed by this adapter'}</p>
    <label>Round ID <input type="number" min="0" step="1" value={roundId} onChange={e => setRoundId(e.target.value)} style={{ display: 'block', width: '100%', marginBottom: 8 }} /></label>
    <label>Refund after block <input type="number" min="1" step="1" value={refundBlock} onChange={e => setRefundBlock(e.target.value)} placeholder="Enter a verified future block" style={{ display: 'block', width: '100%', marginBottom: 8 }} /></label>
    <button type="button" disabled={!connected || busy} onClick={() => void prepare()}>{busy ? 'Preparing…' : 'BUILD LOCAL TRANSACTION REQUEST'}</button>
    {!connected && <p>Connect Bread Wallet first.</p>}
    {error && <p role="alert" style={{ color: '#b42318', overflowWrap: 'anywhere' }}>{error}</p>}
    {result && <div role="status" style={{ fontSize: 12, overflowWrap: 'anywhere' }}>
      <p><b>SDK TransactionRequest built locally. Nothing sent.</b></p>
      <p>Amount: {result.amountGC} GC ({result.amountBaseUnits} base units)</p>
      <p>Note ID: {result.noteId}</p>
      <p>Script root: {result.scriptRoot}</p>
      <p>Owner: {result.owner}</p>
      <p>Refund block: {result.refundAfterBlock}</p>
      <p>Verified SHA-256: {hash}</p>
      <p><b>Real transfer disabled:</b> no proven network refund consumption or winner payout.</p>
    </div>}
  </section>
}
