// OFF-CHAIN REFERENCE MODEL ONLY. Never use this to authorize Gamecoin transfers.
import { createHash } from 'node:crypto';
const hex64 = /^[0-9a-f]{64}$/;
const assert = (ok, message) => { if (!ok) throw new Error(message); };
const hash = (value) => createHash('sha256').update(value).digest('hex');
export function makeRound({ roundId, closeBlock, refundBlock }) {
  assert(Number.isSafeInteger(roundId) && roundId > 0, 'Invalid round ID');
  assert(Number.isSafeInteger(closeBlock) && closeBlock >= 0, 'Invalid close block');
  assert(Number.isSafeInteger(refundBlock) && refundBlock > closeBlock, 'Refund must follow close');
  return { roundId, closeBlock, refundBlock, status: 'open', stakes: [], noteIds: new Set(), consumed: new Set(), settlement: null };
}
export function addStake(round, { noteId, owner, amount }, block) {
  assert(round.status === 'open' && block < round.closeBlock, 'Round closed');
  assert(typeof noteId === 'string' && hex64.test(noteId), 'Invalid note ID');
  assert(typeof owner === 'string' && owner.length > 0, 'Invalid owner');
  assert(typeof amount === 'bigint' && amount > 0n, 'Invalid amount');
  assert(!round.noteIds.has(noteId), 'Duplicate note');
  round.noteIds.add(noteId); round.stakes.push({ noteId, owner, amount });
}
export function closeRound(round, block) {
  assert(round.status === 'open' && block >= round.closeBlock, 'Cannot close');
  round.status = 'closed';
}
export function pot(round) { return round.stakes.reduce((sum, x) => sum + x.amount, 0n); }
export function selectWinner(round, entropyHex) {
  assert(round.status === 'closed' && round.stakes.length > 0, 'Round not ready');
  assert(typeof entropyHex === 'string' && hex64.test(entropyHex), 'Invalid entropy');
  // Canonical ordering ensures the same committed set produces the same result.
  const ordered = [...round.stakes].sort((a, b) => a.noteId.localeCompare(b.noteId));
  const total = pot(round);
  const digest = hash(`bread-wheel-v1|${round.roundId}|${ordered.map(x => `${x.noteId}:${x.owner}:${x.amount}`).join('|')}|${entropyHex}`);
  // Rejection sampling prevents modulo bias; deterministic retry on rejection.
  const range = 1n << 256n; const limit = range - (range % total);
  let sample = digest; let counter = 0;
  while (BigInt(`0x${sample}`) >= limit) sample = hash(`${digest}|retry|${++counter}`);
  let position = BigInt(`0x${sample}`) % total;
  for (const stake of ordered) {
    if (position < stake.amount) return { owner: stake.owner, noteId: stake.noteId, total, commitment: digest };
    position -= stake.amount;
  }
  throw new Error('Unreachable');
}
export function settle(round, winner, block) {
  assert(round.status === 'closed' && block < round.refundBlock, 'Settlement window closed');
  assert(!round.settlement && round.consumed.size === 0, 'Already consumed');
  assert(round.stakes.some(s => s.noteId === winner.noteId && s.owner === winner.owner), 'Invalid winner');
  // This model cannot verify entropy authenticity or Miden ownership proofs.
  round.stakes.forEach(s => round.consumed.add(s.noteId));
  round.settlement = { winner: winner.owner, amount: pot(round) };
  round.status = 'settled';
  return round.settlement;
}
export function cancel(round, block) {
  assert(round.status === 'open' || round.status === 'closed', 'Cannot cancel');
  assert(block >= round.closeBlock, 'Cannot cancel before close');
  round.status = 'cancelled';
}
export function refund(round, noteId, owner, block) {
  assert(round.status === 'cancelled' && block >= round.refundBlock, 'Refund unavailable');
  const stake = round.stakes.find(s => s.noteId === noteId && s.owner === owner);
  assert(stake, 'Not note owner');
  assert(!round.consumed.has(noteId), 'Already consumed');
  round.consumed.add(noteId);
  return stake.amount;
}
