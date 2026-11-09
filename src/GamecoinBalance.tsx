import { useEffect, useState } from 'react'
import { AccountId } from '@miden-sdk/miden-sdk'
import { useMidenFiWallet } from '@miden-sdk/miden-wallet-adapter-react'

const GC_FAUCET = '0x34a3510213533f512ec4abe36baf84'

export default function GamecoinBalance() {
  const { connected, address, requestAssets } = useMidenFiWallet()
  const [balance, setBalance] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    setBalance(null)
    setError('')

    if (!connected || !address || !requestAssets) return

    async function load() {
      try {
        const assets = await requestAssets!()
        const gcId = AccountId.fromHex(GC_FAUCET).toString()

        const total = assets
          .filter(asset => {
            const id = asset.faucetId.startsWith('0x')
              ? AccountId.fromHex(asset.faucetId)
              : AccountId.fromBech32(asset.faucetId)
            return id.toString() === gcId
          })
          .reduce((sum, asset) => sum + BigInt(asset.amount), 0n)

        const whole = total / 1000000n
        const fraction = (total % 1000000n)
          .toString()
          .padStart(6, '0')
          .replace(/0+$/, '')

        if (!cancelled) {
          setBalance(fraction ? `${whole}.${fraction}` : String(whole))
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e))
        }
      }
    }

    void load()
    return () => { cancelled = true }
  }, [connected, address, requestAssets])

  if (!connected) return null

  return (
    <div style={{ textAlign: 'center', margin: '8px 0' }}>
      {error
        ? <p style={{ color: 'red' }}>GC balance error: {error}</p>
        : <p>{balance === null ? 'Reading GC balance...' : `Gamecoin Balance: ${balance} GC`}</p>}
    </div>
  )
}
