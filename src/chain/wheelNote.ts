import {
  AccountId,
  FungibleAsset,
  NoteAssets,
  NoteMetadata,
  NoteTag,
  NoteType,
} from '@miden-sdk/miden-sdk'

import { GC_FAUCET, GC_UNIT } from './stake'

// Unique application tag for Bread Wheel (not GeoQuizz).
export const WHEEL_NOTE_TAG = 0x42570001

export type WheelNoteDraft = {
  roundId: string
  player: string
  amountGC: number
  amountBaseUnits: bigint
  asset: FungibleAsset
  assets: NoteAssets
  metadata: NoteMetadata
}

export function createWheelNoteDraft(
  playerAddress: string,
  roundId: string,
  amountGC = 1
): WheelNoteDraft {
  if (!roundId.trim()) {
    throw new Error('Round ID is required')
  }

  if (!Number.isSafeInteger(amountGC) || amountGC < 1) {
    throw new Error('Stake must be a positive whole number of GC')
  }

  const player = playerAddress.startsWith('0x')
    ? AccountId.fromHex(playerAddress)
    : AccountId.fromBech32(playerAddress)

  const amountBaseUnits = BigInt(amountGC) * GC_UNIT
  const asset = new FungibleAsset(
    AccountId.fromHex(GC_FAUCET),
    amountBaseUnits
  )

  const assets = new NoteAssets([asset])
  const metadata = new NoteMetadata(
    player,
    NoteType.Public,
    new NoteTag(WHEEL_NOTE_TAG)
  )

  return {
    roundId,
    player: playerAddress,
    amountGC,
    amountBaseUnits,
    asset,
    assets,
    metadata,
  }
}
