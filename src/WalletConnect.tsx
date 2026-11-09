import { useState } from 'react'
import { useMidenFiWallet } from '@miden-sdk/miden-wallet-adapter-react'

export default function WalletConnect() {
  const { connected, address, connect, disconnect } = useMidenFiWallet()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleClick() {
    setBusy(true)
    setError('')

    try {
      if (connected) {
        await disconnect()
      } else {
        await connect()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ textAlign: 'center', padding: '16px' }}>
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        style={{
          padding: '12px 24px',
          background: '#29223f',
          color: 'white',
          border: 0,
          borderRadius: 8,
          cursor: 'pointer'
        }}
      >
        {busy ? 'Connecting...' : connected ? 'Disconnect Wallet' : 'Connect Wallet'}
      </button>

      {connected && address && (
        <p>Connected: {address.slice(0, 10)}...{address.slice(-6)}</p>
      )}

      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  )
}
