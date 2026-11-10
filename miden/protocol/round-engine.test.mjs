import test from 'node:test';
import assert from 'node:assert/strict';
import {createRound, placeStake, totalPot, closeStakes, computeWinner, finalizeDraw, cancelRound, refundStake, auditRound} from './round-engine.mjs';
const id = n => n.toString(16).padStart(64,'0');
const entropy = 'f'.repeat(64);
function round() {
  const r = createRound({roundId:'round-42',closeBlock:100,refundBlock:220});
  placeStake(r,{noteId:id(1),owner:'alice',amount:1_000_000n},99);
  placeStake(r,{noteId:id(2),owner:'bob',amount:2_000_000n},99);
  placeStake(r,{noteId:id(3),owner:'carol',amount:3_000_000n},99);
  return r;
}
const proof = () => true; // TEST STUB ONLY, NEVER A PRODUCTION VERIFIER.
test('three-player full reference round pays exactly six GC', () => {
  const r=round(); const commitment=closeStakes(r,100);
  const winner=finalizeDraw(r,{entropyHex:entropy,entropyBlock:101,commitment,proof:'TEST_ONLY'},102,proof);
  assert.ok(['alice','bob','carol'].includes(winner.owner));
  assert.equal(winner.amount,6_000_000n);
  assert.deepEqual(auditRound(r),{state:'settled',total:6_000_000n,consumedValue:6_000_000n,remaining:0n,commitment});
  assert.throws(()=>finalizeDraw(r,{entropyHex:entropy,entropyBlock:101,commitment},103,proof));
  assert.throws(()=>cancelRound(r,220));
  assert.throws(()=>refundStake(r,id(1),'alice',220));
});
test('no proof verifier fails closed', () => {
  const r=round(), commitment=closeStakes(r,100);
  assert.throws(()=>finalizeDraw(r,{entropyHex:entropy,entropyBlock:101,commitment},102),/verifier required/);
  assert.equal(r.state,'closed');
});
test('rejected entropy proof does not consume funds', () => {
  const r=round(), commitment=closeStakes(r,100);
  assert.throws(()=>finalizeDraw(r,{entropyHex:entropy,entropyBlock:101,commitment},102,()=>false),/proof rejected/);
  assert.equal(auditRound(r).remaining,6_000_000n);
});
test('entropy from before or at close rejected', () => {
  const r=round(), commitment=closeStakes(r,100);
  for (const entropyBlock of [99,100,103]) assert.throws(()=>finalizeDraw(r,{entropyHex:entropy,entropyBlock,commitment},102,proof));
});
test('tampering with commitment or stake transcript rejected', () => {
  const r=round(), commitment=closeStakes(r,100);
  assert.throws(()=>finalizeDraw(r,{entropyHex:entropy,entropyBlock:101,commitment:id(7)},102,proof));
  r.stakes[0].amount=5n;
  // The transcript is a frozen commitment: callers must not mutate after close.
  // The engine now explicitly validates it on every draw.
  assert.throws(()=>finalizeDraw(r,{entropyHex:entropy,entropyBlock:101,commitment},102,proof),/transcript changed/);
});
test('canonical stake ordering independent of arrival', () => {
  const a=round(), b=createRound({roundId:'round-42',closeBlock:100,refundBlock:220});
  for(const stake of [...a.stakes].reverse()) placeStake(b,stake,99);
  assert.equal(closeStakes(a,100),closeStakes(b,100));
  assert.deepEqual(computeWinner({round:a,entropyHex:entropy,commitment:a.commitment}),computeWinner({round:b,entropyHex:entropy,commitment:b.commitment}));
});
test('timeout refunds only owner and only once', () => {
  const r=round();closeStakes(r,100);
  assert.throws(()=>cancelRound(r,219));cancelRound(r,220);
  assert.throws(()=>refundStake(r,id(1),'bob',220));
  assert.equal(refundStake(r,id(1),'alice',220),1_000_000n);
  assert.throws(()=>refundStake(r,id(1),'alice',220));
  assert.equal(refundStake(r,id(2),'bob',220),2_000_000n);
  assert.equal(refundStake(r,id(3),'carol',220),3_000_000n);
  assert.equal(auditRound(r).remaining,0n);
});
test('settlement after refund deadline forbidden', () => {
  const r=round(), commitment=closeStakes(r,100);
  assert.throws(()=>finalizeDraw(r,{entropyHex:entropy,entropyBlock:101,commitment},220,proof));
});
test('duplicates and overflow rejected', () => {
  const r=round();assert.throws(()=>placeStake(r,{noteId:id(1),owner:'x',amount:1n},99));
  assert.throws(()=>placeStake(r,{noteId:id(4),owner:'x',amount:(1n<<64n)},99));
  assert.equal(totalPot(r),6_000_000n);
});
test('cannot add stake after closing',()=>{const r=round();closeStakes(r,100);assert.throws(()=>placeStake(r,{noteId:id(4),owner:'dave',amount:1n},101));});
