import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MidenProvider } from '@miden-sdk/react'
import { MidenFiSignerProvider } from '@miden-sdk/miden-wallet-adapter-react'
import { WalletAdapterNetwork } from '@miden-sdk/miden-wallet-adapter-base'
import './index.css'
import App from './App.tsx'
import WalletConnect from './WalletConnect.tsx'
import GamecoinBalance from './GamecoinBalance.tsx'

const midenConfig = {
  rpcUrl: 'https://rpc.cedar.miden.io',
  prover: 'https://tx-prover.cedar.miden.io',
  useWorker: true,
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MidenProvider config={midenConfig} loadingComponent={<div>Loading Miden...</div>}>
      <MidenFiSignerProvider
        appName="Bread Wheel"
        network={("mainnet" as WalletAdapterNetwork)}
        autoConnect={false}
      >
        <WalletConnect />
          <GamecoinBalance />
        <App />
      </MidenFiSignerProvider>
    </MidenProvider>
  </StrictMode>,
)




