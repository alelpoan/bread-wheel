import { NoteArray, TransactionRequestBuilder } from '@miden-sdk/miden-sdk'
import { prepareStakeNoteWithObject, type StakeDraft } from './StakeNoteDraft'

/**
 * Constructs an SDK transaction request containing a real Miden Note object.
 * Does NOT sign or send it. The current MASM script has NO winner payout path.
 * Never pass this request to a wallet until a refund consumption path is verified.
 */
export async function buildStakeTransactionRequest(
  address: string,
  amountGC: number,
  roundId: number,
  refundAfterBlock: number,
): Promise<{ draft: StakeDraft; request: ReturnType<TransactionRequestBuilder['build']> }> {
  const { draft, note } = await prepareStakeNoteWithObject(address, amountGC, roundId, refundAfterBlock)
  const request = new TransactionRequestBuilder().withOwnOutputNotes(new NoteArray([note])).build()
  return { draft, request }
}
