import { useState } from 'react'
import { useMidenFiWallet } from '@miden-sdk/miden-wallet-adapter-react'
import { buildStakeTransactionRequest } from './StakeTransactionRequest'
import type { StakeDraft } from './StakeNoteDraft'

const EXPECTED_SHA256 = '830cd8f890bc24b511dd0979ff7a62857fd2e71ed2f68ca2685918be26ed4617'
const RPC_ENDPOINT = 'https://rpc.cedar.miden.io'
// 120 blocks is a safety margin, NOT a guaranteed wall-clock duration.
const REFUND_DELAY_BLOCKS = 120

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

async function readCurrentBlock(): Promise<number> {
  // Separate read-only client. Never signs or submits any transaction.
  const { MidenClient } = await import('@miden-sdk/miden-sdk')
  const client = await MidenClient.create({ rpcUrl: RPC_ENDPOINT })
  try {
    await client.sync()
    const height = await client.getSyncHeight()
    if (!Number.isSafeInteger(height) || height < 1) throw new Error('RPC did not provide a valid current block height')
    return height
  } finally {
    client.terminate()
  }
}

/** Local request construction only. No Gamecoin is transferred. */
export default function StakeArtifactPreflight() {
  const wallet = useMidenFiWallet()
  const { connected, address } = wallet
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<StakeDraft | null>(null)
  const [hash, setHash] = useState('')
  const [chainBlock, setChainBlock] = useState<number | null>(null)
  const [error, setError] = useState('')
  const walletHasRequestTransaction = 'requestTransaction' in wallet && typeof wallet.requestTransaction === 'function'

  async function prepare() {
    setBusy(true); setError(''); setResult(null); setHash(''); setChainBlock(null)
    try {
      if (!connected || !address) throw new Error('Connect Bread Wallet first.')
      const verifiedHash = await verifyArtifact()
      const current = await readCurrentBlock()
      const deadline = current + REFUND_DELAY_BLOCKS
      if (!Number.isSafeInteger(deadline)) throw new Error('Refund block is outside the safe integer range')
      // Round 1 is explicitly a TEST value, not the live roulette round.
      const { draft, request } = await buildStakeTransactionRequest(address, 1, 1, deadline)
      if (!request) throw new Error('SDK did not create a transaction request.')
      setChainBlock(current); setHash(verifiedHash); setResult(draft)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally { setBusy(false) }
  }

  return <section style={{ border: '1px solid #a6a6a6', borderRadius: 12, padding: 16, marginTop: 16, background: '#fff', color: '#222' }}>
    <h3 style={{ marginTop: 0 }}>MASM Note — transaction preparation</h3>
    <p style={{ fontSize: 13 }}>Reads the current Miden block, calculates a future refund block, verifies the MASM artifact and builds a local SDK request for 1 GC. No transaction is signed or sent.</p>
    <p style={{ fontSize: 12 }}>Wallet transaction API: {walletHasRequestTransaction ? 'requestTransaction available' : 'requestTransaction not exposed by this adapter'}</p>
    <button type="button" disabled={!connected || busy} onClick={() => void prepare()}>{busy ? 'PREPARING…' : 'BUILD LOCAL TRANSACTION REQUEST'}</button>
    {!connected && <p>Connect Bread Wallet first.</p>}
    {error && <p role="alert" style={{ color: '#b42318', overflowWrap: 'anywhere' }}>{error}</p>}
    {result && <div role="status" style={{ fontSize: 12, overflowWrap: 'anywhere' }}>
      <p><b>SDK TransactionRequest built locally. Nothing sent.</b></p>
      <p>Current chain block: {chainBlock}</p>
      <p>Refund after block: {result.refundAfterBlock} (+{REFUND_DELAY_BLOCKS} blocks)</p>
      <p>Round ID: {result.roundId} (test only)</p>
      <p>Amount: {result.amountGC} GC ({result.amountBaseUnits} base units)</p>
      <p>Note ID: {result.noteId}</p>
      <p>Script root: {result.scriptRoot}</p>
      <p>Owner: {result.owner}</p>
      <p>Verified SHA-256: {hash}</p>
      <p><b>Real transfer disabled:</b> refund consumption and winner payouts are not network-verified.</p>
    </div>}
  </section>
}
