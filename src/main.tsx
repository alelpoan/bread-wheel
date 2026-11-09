import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MidenProvider } from '@miden-sdk/react'
import { MidenFiSignerProvider } from '@miden-sdk/miden-wallet-adapter-react'
import { WalletAdapterNetwork } from '@miden-sdk/miden-wallet-adapter-base'
import './index.css'
import App from './App.tsx'

const midenConfig = {
  rpcUrl: 'https://rpc.testnet.miden.io',
  prover: 'https://tx-prover.testnet.miden.io',
  useWorker: true,
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MidenProvider config={midenConfig} loadingComponent={<div>Loading Miden...</div>}>
      <MidenFiSignerProvider
        appName="Bread Wheel"
        network={WalletAdapterNetwork.Testnet}
        autoConnect={false}
      >
        <App />
      </MidenFiSignerProvider>
    </MidenProvider>
  </StrictMode>,
)
