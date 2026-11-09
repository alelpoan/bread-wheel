import {
  AccountId, Felt, FeltArray, FungibleAsset, Note, NoteAssets,
  NoteMetadata, NoteRecipient, NoteScript, NoteStorage, NoteTag, NoteType, Word,
} from '@miden-sdk/miden-sdk'

export const GC_FAUCET = '0x34a3510213533f512ec4abe36baf84'
export const GC_UNIT = 1_000_000n
export type StakeDraft = {
  noteId: string
  scriptRoot: string
  owner: string
  amountGC: number
  amountBaseUnits: string
  roundId: number
  refundAfterBlock: number
  storage: string[]
}

function parseAccountId(address: string): AccountId {
  return address.startsWith('0x') ? AccountId.fromHex(address) : AccountId.fromBech32(address)
}

// Use the field modulus: arbitrary 64-bit values are not always valid Felts.
const FELT_MODULUS = 18446744069414584321n

function freshSerial(): Word {
  const bytes = new Uint32Array(8)
  crypto.getRandomValues(bytes)
  const values: Felt[] = []
  for (let i = 0; i < 4; i++) {
    values.push(new Felt(((BigInt(bytes[i * 2 + 1]) << 32n) | BigInt(bytes[i * 2])) % FELT_MODULUS))
  }
  return Word.newFromFelts(values)
}

/** Constructs a Note locally; does NOT sign, submit, lock or transfer assets. */
export async function prepareStakeNoteWithObject(address: string, amountGC: number, roundId: number, refundAfterBlock: number): Promise<{ draft: StakeDraft; note: Note }> {
  if (!Number.isSafeInteger(amountGC) || amountGC < 1) throw new Error('Amount must be a positive whole GC number')
  if (!Number.isSafeInteger(roundId) || roundId < 0) throw new Error('Invalid round ID')
  if (!Number.isSafeInteger(refundAfterBlock) || refundAfterBlock < 1) throw new Error('Invalid refund block')

  const owner = parseAccountId(address)
  const response = await fetch('/stake-note.bin', { cache: 'no-store' })
  if (!response.ok) throw new Error('Compiled stake-note.bin is not installed. Note creation remains disabled until MASM build and refund tests are verified.')
  const bytes = new Uint8Array(await response.arrayBuffer())
  const script = NoteScript.deserialize(bytes)
  const storage = [owner.suffix().asInt(), owner.prefix().asInt(), BigInt(roundId), BigInt(refundAfterBlock)]
  const felts = new FeltArray()
  for (const value of storage) felts.push(new Felt(value))
  const recipient = new NoteRecipient(freshSerial(), script, new NoteStorage(felts))
  const metadata = new NoteMetadata(owner, NoteType.Public, new NoteTag(0))
  const amountBaseUnits = BigInt(amountGC) * GC_UNIT
  const note = new Note(new NoteAssets([new FungibleAsset(AccountId.fromHex(GC_FAUCET), amountBaseUnits)]), metadata, recipient)
  const draft: StakeDraft = {
    noteId: note.id().toString(), scriptRoot: script.root().toHex(), owner: owner.toString(),
    amountGC, amountBaseUnits: amountBaseUnits.toString(), roundId, refundAfterBlock,
    storage: storage.map(String),
  }
  return { draft, note }
}

/** Read-only compatibility API used by existing panels. */
export async function prepareStakeNote(address: string, amountGC: number, roundId: number, refundAfterBlock: number): Promise<StakeDraft> {
  return (await prepareStakeNoteWithObject(address, amountGC, roundId, refundAfterBlock)).draft
}

