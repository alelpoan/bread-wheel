import { useMidenFiWallet } from '@miden-sdk/miden-wallet-adapter-react'

const GC_UNIT = 1_000_000n

function formatGC(value: bigint): string {
  const whole = value / GC_UNIT
  const fraction = (value % GC_UNIT).toString().padStart(6, '0').replace(/0+$/, '')
  return fraction ? `${whole}.${fraction}` : String(whole)
}

/** Read-only wallet profile. No stake, claim, or transaction is initiated here. */
export default function RealWalletProfile({ balanceBaseUnits }: { balanceBaseUnits: bigint | null }) {
  const { connected, address } = useMidenFiWallet()

  return (
    <section style={{ maxWidth: 440, margin: '20px auto', padding: 20, border: '1px solid #ddd', borderRadius: 14, background: '#fff', color: '#29243e', textAlign: 'left' }}>
      <h2 style={{ marginTop: 0, marginBottom: 12 }}>MY WALLET</h2>
      {!connected || !address ? (
        <p style={{ color: '#777', marginBottom: 0 }}>Connect Bread Wallet to view your Gamecoin profile.</p>
      ) : (
        <>
          <div style={{ fontSize: 13, color: '#16865c', fontWeight: 700 }}>● Connected</div>
          <div style={{ fontSize: 13, marginTop: 8, overflowWrap: 'anywhere' }}>
            <span style={{ color: '#777' }}>Wallet: </span>
            <span title={address}>{address}</span>
          </div>
          <div style={{ borderTop: '1px solid #eee', marginTop: 16, paddingTop: 14 }}>
            <div style={{ fontSize: 13, color: '#777' }}>Available Gamecoin (wallet snapshot)</div>
            <div style={{ fontSize: 26, fontWeight: 800, marginTop: 4 }}>
              {balanceBaseUnits === null ? 'Not loaded' : `${formatGC(balanceBaseUnits)} GC`}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
            <div style={{ background: '#f5f3fb', borderRadius: 9, padding: 12 }}>
              <div style={{ fontSize: 12, color: '#777' }}>Current onchain bet</div>
              <strong>Not available</strong>
            </div>
            <div style={{ background: '#f5f3fb', borderRadius: 9, padding: 12 }}>
              <div style={{ fontSize: 12, color: '#777' }}>Pending onchain winnings</div>
              <strong>Not available</strong>
            </div>
          </div>
          <p style={{ fontSize: 12, color: '#777', marginBottom: 0, marginTop: 14 }}>
            Real betting and CLAIM are not enabled. No tokens are sent or locked by this profile. The demo below is separate from this wallet.
          </p>
        </>
      )}
    </section>
  )
}
