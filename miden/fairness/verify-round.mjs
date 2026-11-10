// Bread Wheel — deterministic OFFCHAIN transcript verifier. NOT a Miden contract.
// A seed is valid only when supplied by an independently authenticated,
// unpredictable randomness source after betting closes. This module does not
// authenticate the source or provide randomness itself.
import { createHash } from 'node:crypto'

const MAX_U64 = 1n << 64n
const MAX_U256 = 1n << 256n
const DOMAIN = 'BREAD_WHEEL_V1_WINNER'
function fail(msg) { throw new Error(msg) }
function positiveIntString(x, name) {
  if (typeof x !== 'string' || !/^[1-9]\d*$/.test(x)) fail(`${name} must be a positive decimal string`)
  return BigInt(x)
}
function canonicalId(x) {
  if (typeof x !== 'string' || !/^[a-zA-Z0-9:_-]{1,128}$/.test(x)) fail('Invalid player or note id')
  return x
}
function sha256(b) { return createHash('sha256').update(b).digest() }
function enc(x) { const b = Buffer.from(String(x),'utf8'); const len=Buffer.alloc(4);len.writeUInt32BE(b.length);return Buffer.concat([len,b]) }
function encodeFields(...fields) { return Buffer.concat(fields.map(enc)) }
function validateRound(round) {
  if (!round || typeof round !== 'object') fail('Round object required')
  const id=canonicalId(round.roundId)
  if (!Number.isSafeInteger(round.closeBlock) || round.closeBlock<0) fail('Invalid closeBlock')
  if (!Array.isArray(round.stakes) || round.stakes.length<2) fail('At least two stakes required')
  const seenNotes=new Set();let total=0n
  const stakes=round.stakes.map(s=>{
    const player=canonicalId(s.playerId), note=canonicalId(s.noteId)
    if (seenNotes.has(note)) fail('Duplicate noteId');seenNotes.add(note)
    const amount=positiveIntString(s.amountBaseUnits,'amountBaseUnits')
    if (amount>=MAX_U64) fail('Amount exceeds u64')
    total+=amount
    if (total>=MAX_U64) fail('Total exceeds u64')
    return {playerId:player,noteId:note,amountBaseUnits:amount.toString()}
  })
  // Canonical order must not depend on UI order or arrival order.
  stakes.sort((a,b)=>a.noteId<b.noteId?-1:a.noteId>b.noteId?1:0)
  return {roundId:id,closeBlock:round.closeBlock,stakes,total}
}
export function commitRound(round) {
  const r=validateRound(round)
  const parts=[DOMAIN,'round',r.roundId,r.closeBlock,r.stakes.length]
  for(const s of r.stakes) parts.push(s.noteId,s.playerId,s.amountBaseUnits)
  return {commitment:sha256(encodeFields(...parts)).toString('hex'),totalBaseUnits:r.total.toString(),stakes:r.stakes}
}
export function verifyDraw({round,commitment,randomnessHex,randomnessBlock}) {
  const r=validateRound(round)
  if (!Number.isSafeInteger(randomnessBlock) || randomnessBlock<=r.closeBlock) fail('Randomness must be produced after closeBlock')
  if (typeof randomnessHex!=='string' || !/^[0-9a-fA-F]{64}$/.test(randomnessHex)) fail('Randomness must be 32-byte hex')
  if (typeof commitment!=='string' || !/^[0-9a-f]{64}$/.test(commitment)) fail('Invalid commitment')
  const computed=commitRound(round)
  if(computed.commitment!==commitment) fail('Stakes changed after commitment')
  // Rejection sampling avoids modulo bias.
  const limit=MAX_U256-(MAX_U256%r.total)
  let draw
  let counter=0
  while(true) {
    const digest=sha256(encodeFields(DOMAIN,'draw',commitment,randomnessHex.toLowerCase(),counter))
    const n=BigInt('0x'+digest.toString('hex'))
    if(n<limit) { draw=n%r.total;break }
    if(++counter>10000) fail('Rejection sampling exceeded limit')
  }
  let cursor=0n
  for(const s of r.stakes) {
    cursor+=BigInt(s.amountBaseUnits)
    if(draw<cursor) return {winnerId:s.playerId,winnerNoteId:s.noteId,totalBaseUnits:r.total.toString(),ticket:draw.toString(),commitment,randomnessBlock}
  }
  fail('Invariant violated')
}
