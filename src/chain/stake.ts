import { AccountId } from '@miden-sdk/miden-sdk'

export const GC_FAUCET = '0x34a3510213533f512ec4abe36baf84'
export const GC_UNIT = 1_000_000n
export const MAX_PLAYERS = 20

type WalletAsset = {
  faucetId: string
  amount: string | number | bigint
}

export type StakeWallet = {
  connected: boolean
  address: string | null
  requestAssets?: () => Promise<WalletAsset[]>
}

export type StakeDraft = {
  player: string
  amountGC: number
  amountBaseUnits: bigint
  balanceBaseUnits: bigint
  status: 'ready'
}

function normalizeAccountId(value: string): string {
  const id = value.startsWith('0x')
    ? AccountId.fromHex(value)
    : AccountId.fromBech32(value)
  return id.toString()
}

export async function prepareStake(
  wallet: StakeWallet,
  amountGC: number
): Promise<StakeDraft> {
  if (!wallet.connected || !wallet.address) {
    throw new Error('Connect Bread Wallet first')
  }

  if (!wallet.requestAssets) {
    throw new Error('Wallet cannot read assets')
  }

  if (!Number.isSafeInteger(amountGC) || amountGC < 1) {
    throw new Error('Stake must be a positive whole number of GC')
  }

  const amountBaseUnits = BigInt(amountGC) * GC_UNIT
  const assets = await wallet.requestAssets()
  const faucet = normalizeAccountId(GC_FAUCET)

  const balanceBaseUnits = assets
    .filter(asset => normalizeAccountId(asset.faucetId) === faucet)
    .reduce((total, asset) => total + BigInt(asset.amount), 0n)

  if (balanceBaseUnits < amountBaseUnits) {
    throw new Error('Not enough Gamecoin')
  }

  return {
    player: wallet.address,
    amountGC,
    amountBaseUnits,
    balanceBaseUnits,
    status: 'ready',
  }
}
