import test from 'node:test';
import assert from 'node:assert/strict';
import {makeRound, addStake, closeRound, pot, selectWinner, settle, cancel, refund} from './round-model.mjs';
const note = i => i.toString(16).padStart(64, '0');
function setup() { const r = makeRound({roundId: 59,closeBlock: 100,refundBlock: 220}); addStake(r,{noteId:note(1),owner:'alice',amount:1_000_000n},99); addStake(r,{noteId:note(2),owner:'bob',amount:2_000_000n},99); return r; }
test('locks canonical stake set and calculates exact BigInt pot',()=>{const r=setup();assert.equal(pot(r),3_000_000n);assert.throws(()=>addStake(r,{noteId:note(1),owner:'alice',amount:1n},99),/Duplicate/);assert.throws(()=>addStake(r,{noteId:note(3),owner:'eve',amount:1n},100),/closed/);});
test('weighted draw is deterministic for a fixed input',()=>{const r=setup();closeRound(r,100);assert.deepEqual(selectWinner(r,'a'.repeat(64)),selectWinner(r,'a'.repeat(64)));});
test('settlement consumes notes and prevents refunds or double settlement',()=>{const r=setup();closeRound(r,100);const w=selectWinner(r,'b'.repeat(64));assert.equal(settle(r,{winner:w,entropyHex:'b'.repeat(64)},101).amount,3_000_000n);assert.throws(()=>settle(r,{winner:w,entropyHex:'b'.repeat(64)},102));assert.throws(()=>cancel(r,220));assert.throws(()=>refund(r,note(1),'alice',220));});
test('cancellation refunds owners only once after deadline',()=>{const r=setup();closeRound(r,100);cancel(r,101);assert.throws(()=>refund(r,note(1),'alice',219));assert.throws(()=>refund(r,note(1),'bob',220));assert.equal(refund(r,note(1),'alice',220),1_000_000n);assert.throws(()=>refund(r,note(1),'alice',221));assert.equal(refund(r,note(2),'bob',220),2_000_000n);});
test('cannot settle after refund deadline',()=>{const r=setup();closeRound(r,100);assert.throws(()=>settle(r,{winner:selectWinner(r,'c'.repeat(64)),entropyHex:'c'.repeat(64)},220));});
test('empty rounds cannot select winner',()=>{const r=makeRound({roundId:1,closeBlock:10,refundBlock:20});closeRound(r,10);assert.throws(()=>selectWinner(r,'a'.repeat(64)));});

test('rejects participant substitution even if participant exists',()=>{
 const r=setup();closeRound(r,100);const entropy='d'.repeat(64);const winner=selectWinner(r,entropy);
 const other=r.stakes.find(s=>s.noteId!==winner.noteId);
 assert.throws(()=>settle(r,{winner:{...winner,owner:other.owner,noteId:other.noteId},entropyHex:entropy},101),/verified draw/);
 assert.equal(r.status,'closed');assert.equal(r.consumed.size,0);
});
test('rejects entropy substitution after a winner was calculated',()=>{
 const r=setup();closeRound(r,100);const winner=selectWinner(r,'e'.repeat(64));
 assert.throws(()=>settle(r,{winner,entropyHex:'f'.repeat(64)},101),/verified draw/);
 assert.equal(r.consumed.size,0);
});
test('rejects forged draw commitment or amount',()=>{
 const r=setup();closeRound(r,100);const entropy='1'.repeat(64);const winner=selectWinner(r,entropy);
 assert.throws(()=>settle(r,{winner:{...winner,commitment:'0'.repeat(64)},entropyHex:entropy},101),/verified draw/);
 assert.throws(()=>settle(r,{winner:{...winner,total:1n},entropyHex:entropy},101),/verified draw/);
});
test('rejects settlement without explicit entropy',()=>{
 const r=setup();closeRound(r,100);const winner=selectWinner(r,'a'.repeat(64));
 assert.throws(()=>settle(r,{winner},101),/Invalid entropy/);
});
