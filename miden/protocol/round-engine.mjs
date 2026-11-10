/**
 * Bread Wheel reference round engine. OFF-CHAIN ONLY.
 * No transaction signing, no Miden note spending, no Gamecoin transfers.
 * Authenticated entropy is intentionally NOT implemented: an adapter must
 * independently validate the entropy proof before calling finalizeDraw.
 */
import { createHash } from 'node:crypto';

const U64_MAX = (1n << 64n) - 1n;
const MAX_U256 = 1n << 256n;
const NOTE_RE = /^[0-9a-f]{64}$/;
const ACCOUNT_RE = /^[a-zA-Z0-9:_-]{1,128}$/;
const fail = (message) => { throw new Error(message); };
const requireThat = (ok, message) => { if (!ok) fail(message); };
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const enc = (...values) => values.map(value => {
  const data = Buffer.from(String(value), 'utf8');
  const size = Buffer.alloc(4); size.writeUInt32BE(data.length);
  return Buffer.concat([size, data]);
});
const digest = (...values) => sha(Buffer.concat(enc(...values)));
const asBlock = (value) => Number.isSafeInteger(value) && value >= 0;
const cloneStake = ({noteId, owner, amount}) => ({noteId, owner, amount});

export function createRound({roundId, closeBlock, refundBlock}) {
  requireThat(typeof roundId === 'string' && ACCOUNT_RE.test(roundId), 'Invalid round ID');
  requireThat(asBlock(closeBlock) && asBlock(refundBlock) && refundBlock > closeBlock, 'Invalid round deadlines');
  return {roundId, closeBlock, refundBlock, state: 'open', stakes: [], consumed: new Set(), commitment: null, entropyProof: null, result: null};
}
export function placeStake(round, stake, block) {
  requireThat(round.state === 'open' && asBlock(block) && block < round.closeBlock, 'Staking closed');
  requireThat(typeof stake?.noteId === 'string' && NOTE_RE.test(stake.noteId), 'Invalid note ID');
  requireThat(typeof stake.owner === 'string' && ACCOUNT_RE.test(stake.owner), 'Invalid owner');
  requireThat(typeof stake.amount === 'bigint' && stake.amount > 0n && stake.amount <= U64_MAX, 'Invalid stake amount');
  requireThat(!round.stakes.some(s => s.noteId === stake.noteId), 'Duplicate note');
  requireThat(totalPot(round) + stake.amount <= U64_MAX, 'Pot exceeds u64');
  round.stakes.push(cloneStake(stake));
}
export function totalPot(round) { return round.stakes.reduce((sum, s) => sum + s.amount, 0n); }
export function closeStakes(round, block) {
  requireThat(round.state === 'open' && asBlock(block) && block >= round.closeBlock, 'Cannot close yet');
  requireThat(round.stakes.length >= 2, 'At least two stakes required');
  const ordered = round.stakes.map(cloneStake).sort((a,b) => a.noteId.localeCompare(b.noteId));
  round.commitment = digest('BREAD_WHEEL_ROUND_V2', round.roundId, round.closeBlock, round.refundBlock, ordered.length,
    ...ordered.flatMap(s => [s.noteId, s.owner, s.amount]));
  round.state = 'closed';
  return round.commitment;
}
function verifyTranscript(round) {
  if (round.state !== 'closed') return;
  const ordered = round.stakes.map(cloneStake).sort((a,b) => a.noteId.localeCompare(b.noteId));
  const current = digest('BREAD_WHEEL_ROUND_V2', round.roundId, round.closeBlock, round.refundBlock, ordered.length, ...ordered.flatMap(s => [s.noteId, s.owner, s.amount]));
  requireThat(current === round.commitment, 'Round transcript changed after close');
}
export function computeWinner({round, entropyHex, commitment}) {
  verifyTranscript(round);
  requireThat(round.state === 'closed', 'Round not closed');
  requireThat(commitment === round.commitment && typeof commitment === 'string', 'Commitment mismatch');
  requireThat(typeof entropyHex === 'string' && NOTE_RE.test(entropyHex), 'Invalid entropy');
  const ordered = round.stakes.map(cloneStake).sort((a,b) => a.noteId.localeCompare(b.noteId));
  const total = totalPot(round);
  const limit = MAX_U256 - MAX_U256 % total;
  let sample, counter = 0;
  do {
    requireThat(counter < 10000, 'Rejection sampler exhausted');
    sample = BigInt('0x' + digest('BREAD_WHEEL_DRAW_V2', commitment, entropyHex, counter++));
  } while (sample >= limit);
  const ticket = sample % total;
  let cursor = 0n;
  for (const stake of ordered) {
    cursor += stake.amount;
    if (ticket < cursor) return {owner: stake.owner, noteId: stake.noteId, amount: total, ticket, commitment};
  }
  return fail('Winner selection invariant violated');
}
/**
 * A verification callback must return true only after validating a proof from
 * an independently authenticated post-close randomness source, bound to this
 * exact round commitment. This callback is a TRUST BOUNDARY, NOT a MASM proof.
 */
export function finalizeDraw(round, {entropyHex, entropyBlock, commitment, proof}, block, verifyEntropyProof) {
  verifyTranscript(round);
  requireThat(round.state === 'closed', 'Round not available');
  requireThat(asBlock(block) && block < round.refundBlock, 'Settlement window expired');
  requireThat(asBlock(entropyBlock) && entropyBlock > round.closeBlock && entropyBlock <= block, 'Entropy must be post-close');
  requireThat(commitment === round.commitment, 'Commitment mismatch');
  requireThat(typeof verifyEntropyProof === 'function', 'Authenticated entropy verifier required');
  const evidence = Object.freeze({roundId: round.roundId, commitment, closeBlock: round.closeBlock, entropyBlock, entropyHex, proof});
  requireThat(verifyEntropyProof(evidence) === true, 'Entropy proof rejected');
  const winner = computeWinner({round, entropyHex, commitment});
  requireThat(round.consumed.size === 0, 'Notes already consumed');
  for (const stake of round.stakes) round.consumed.add(stake.noteId);
  round.entropyProof = {entropyBlock, entropyHex};
  round.result = winner;
  round.state = 'settled';
  return winner;
}
export function cancelRound(round, block) {
  requireThat(['open', 'closed'].includes(round.state), 'Round already resolved');
  requireThat(asBlock(block) && block >= round.refundBlock, 'Refund deadline not reached');
  round.state = 'cancelled';
}
export function refundStake(round, noteId, owner, block) {
  requireThat(round.state === 'cancelled' && asBlock(block) && block >= round.refundBlock, 'Refund unavailable');
  const stake = round.stakes.find(s => s.noteId === noteId && s.owner === owner);
  requireThat(stake, 'Not the note owner');
  requireThat(!round.consumed.has(noteId), 'Note already consumed');
  round.consumed.add(noteId);
  return stake.amount;
}
export function auditRound(round) {
  const total = totalPot(round);
  const consumedValue = round.stakes.filter(s => round.consumed.has(s.noteId)).reduce((n,s) => n + s.amount, 0n);
  requireThat(consumedValue <= total, 'Conservation violated');
  requireThat(round.state !== 'settled' || consumedValue === total, 'Settlement incomplete');
  return {state: round.state, total, consumedValue, remaining: total - consumedValue, commitment: round.commitment};
}
