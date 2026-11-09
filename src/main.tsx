import { StrictMode, useCallback, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MidenProvider } from '@miden-sdk/react'
import { MidenFiSignerProvider } from '@miden-sdk/miden-wallet-adapter-react'
import { WalletAdapterNetwork } from '@miden-sdk/miden-wallet-adapter-base'
import './index.css'
import './Dashboard.css'
import App from './App.tsx'
import WalletConnect from './WalletConnect.tsx'
import GamecoinBalance from './GamecoinBalance.tsx'
import RealStakePreview from './RealStakePreview.tsx'
import RoundRulesPreview from './RoundRulesPreview.tsx'
import RealWalletProfile from './RealWalletProfile.tsx'

const midenConfig = {
  rpcUrl: 'https://rpc.cedar.miden.io',
  prover: 'https://tx-prover.cedar.miden.io',
  useWorker: true,
}

function GameWithBalance() {
  const [balance, setBalance] = useState<bigint | null>(null)
  const onBalanceChange = useCallback((value: bigint | null) => setBalance(value), [])
  return (
    <div className="bread-dashboard">
      <header className="bread-dashboard-header">
        <div className="bread-brand">
          <strong>BREAD WHEEL</strong>
          <span>Free-for-All В· Demo playground</span>
        </div>
        <div className="bread-wallet-controls">
          <WalletConnect />
          <div className="bread-header-balance"><GamecoinBalance onBalanceChange={onBalanceChange} /></div>
        </div>
      </header>
      <div className="bread-dashboard-columns">
        <div className="bread-game-column"><App /></div>
        <aside className="bread-sidebar" aria-label="Wallet and stake tools">
          <RealWalletProfile balanceBaseUnits={balance} />
          <div id="bread-demo-wallet-slot" className="bread-demo-wallet-slot" />
          <RealStakePreview balanceBaseUnits={balance} />
          <RoundRulesPreview />
          <div className="bread-safety-note">Real Gamecoin betting is not enabled. The wheel and demo balances are simulations.</div>
        </aside>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MidenProvider config={midenConfig} loadingComponent={<div>Loading Miden...</div>}>
      <MidenFiSignerProvider
        appName="Bread Wheel"
        network={('mainnet' as WalletAdapterNetwork)}
        autoConnect={false}
      >
        <GameWithBalance />
      </MidenFiSignerProvider>
    </MidenProvider>
  </StrictMode>,
)

