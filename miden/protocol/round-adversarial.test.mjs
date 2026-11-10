import test from 'node:test';
import assert from 'node:assert/strict';
import {createRound,placeStake,closeStakes,computeWinner,finalizeDraw,cancelRound,refundStake,auditRound} from './round-engine.mjs';
const id=n=>n.toString(16).padStart(64,'0');
const entropy='ab'.repeat(32);
const make=()=>{
 const r=createRound({roundId:'wheel-integration',closeBlock:100,refundBlock:150});
 for(let i=1;i<=3;i++)placeStake(r,{noteId:id(i),owner:`wallet-${i}`,amount:BigInt(i)*1_000_000n},99);
 return r;
};
const verified=()=>true; // ONLY A TEST STUB; NEVER AN ONCHAIN PROOF.
const args=c=>({entropyHex:entropy,entropyBlock:101,commitment:c,proof:'TEST_STUB'});
test('reference: exact 1+2+3 GC accounting and no replay',()=>{
 const r=make(),c=closeStakes(r,100),w=finalizeDraw(r,args(c),101,verified);
 assert.equal(w.amount,6_000_000n);
 assert.equal(auditRound(r).remaining,0n);
 assert.throws(()=>finalizeDraw(r,args(c),101,verified));
 assert.throws(()=>refundStake(r,id(1),'wallet-1',150));
});
test('reference: refund each of three notes, no double refunds',()=>{
 const r=make();closeStakes(r,100);cancelRound(r,150);
 for(let i=1;i<=3;i++){
  assert.equal(refundStake(r,id(i),`wallet-${i}`,150),BigInt(i)*1_000_000n);
  assert.throws(()=>refundStake(r,id(i),`wallet-${i}`,150));
 }
 assert.equal(auditRound(r).remaining,0n);
});
test('reference: no verified entropy, no settlement',()=>{
 const r=make(),c=closeStakes(r,100);
 assert.throws(()=>finalizeDraw(r,args(c),101,()=>false),/proof rejected/);
 assert.equal(auditRound(r).remaining,6_000_000n);
});
test('reference: unverified entropy verifier missing fails closed',()=>{
 const r=make(),c=closeStakes(r,100);
 assert.throws(()=>finalizeDraw(r,args(c),101),/verifier required/);
});
test('reference: no late settlement',()=>{
 const r=make(),c=closeStakes(r,100);
 assert.throws(()=>finalizeDraw(r,args(c),150,verified),/expired/);
});
test('reference: no early entropy',()=>{
 const r=make(),c=closeStakes(r,100);
 assert.throws(()=>finalizeDraw(r,{...args(c),entropyBlock:100},101,verified),/post-close/);
});
test('reference: cannot forge commitment',()=>{
 const r=make(),c=closeStakes(r,100);
 assert.throws(()=>finalizeDraw(r,{...args(c),commitment:id(99)},101,verified),/mismatch/);
});
test('reference: cannot mutate stakes after close',()=>{
 const r=make(),c=closeStakes(r,100);r.stakes[1].amount=10_000_000n;
 assert.throws(()=>finalizeDraw(r,args(c),101,verified),/transcript changed/);
});
test('reference: cannot add notes after close',()=>{
 const r=make();closeStakes(r,100);
 assert.throws(()=>placeStake(r,{noteId:id(4),owner:'wallet-4',amount:1n},101),/closed/);
});
test('reference: winner is deterministic and always an actual participant',()=>{
 const r=make(),c=closeStakes(r,100),a=computeWinner({round:r,entropyHex:entropy,commitment:c}),b=computeWinner({round:r,entropyHex:entropy,commitment:c});
 assert.deepEqual(a,b);assert.ok(['wallet-1','wallet-2','wallet-3'].includes(a.owner));
});
test('reference: refund to wrong wallet forbidden',()=>{
 const r=make();closeStakes(r,100);cancelRound(r,150);
 assert.throws(()=>refundStake(r,id(1),'wallet-2',150),/Not the note owner/);
});
test('reference: cannot settle after cancel',()=>{
 const r=make(),c=closeStakes(r,100);cancelRound(r,150);
 assert.throws(()=>finalizeDraw(r,args(c),151,verified));
});
