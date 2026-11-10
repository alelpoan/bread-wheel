import test from 'node:test'
import assert from 'node:assert/strict'
import {commitRound,verifyDraw} from './verify-round.mjs'
const base={roundId:'round_59',closeBlock:100,stakes:[{playerId:'alice',noteId:'n1',amountBaseUnits:'1000000'},{playerId:'bob',noteId:'n2',amountBaseUnits:'2000000'},{playerId:'carol',noteId:'n3',amountBaseUnits:'3000000'}]}
const seed='ab'.repeat(32)
const run=(round=base,commitment=commitRound(base).commitment,randomnessBlock=101)=>verifyDraw({round,commitment,randomnessHex:seed,randomnessBlock})
test('same transcript yields same winner',()=>assert.deepEqual(run(),run()))
test('input order does not alter commitment or draw',()=>{const shuffled={...base,stakes:[...base.stakes].reverse()};assert.equal(commitRound(shuffled).commitment,commitRound(base).commitment);assert.deepEqual(run(shuffled),run())})
test('winner belongs to a participant and receives total',()=>{const result=run();assert.ok(base.stakes.some(s=>s.playerId===result.winnerId));assert.equal(result.totalBaseUnits,'6000000')})
test('stake modification after close is rejected',()=>{const tampered=structuredClone(base);tampered.stakes[1].amountBaseUnits='9000000';assert.throws(()=>run(tampered),/changed/)})
test('stake insertion after close is rejected',()=>{const tampered=structuredClone(base);tampered.stakes.push({playerId:'mallory',noteId:'n4',amountBaseUnits:'1'});assert.throws(()=>run(tampered),/changed/)})
test('randomness at or before close is rejected',()=>{assert.throws(()=>run(base,commitRound(base).commitment,100),/after close/);assert.throws(()=>run(base,commitRound(base).commitment,99),/after close/)})
test('duplicate note cannot be counted twice',()=>{const tampered=structuredClone(base);tampered.stakes[1].noteId='n1';assert.throws(()=>commitRound(tampered),/Duplicate/)})
test('invalid stake amounts rejected',()=>{for(const x of ['0','-1','1.5','01']){const tampered=structuredClone(base);tampered.stakes[0].amountBaseUnits=x;assert.throws(()=>commitRound(tampered))}})
test('overflow rejected',()=>{const tampered=structuredClone(base);tampered.stakes[0].amountBaseUnits='18446744073709551616';assert.throws(()=>commitRound(tampered),/u64/)})
test('missing randomness rejected',()=>assert.throws(()=>verifyDraw({round:base,commitment:commitRound(base).commitment,randomnessHex:'00',randomnessBlock:101}),/32-byte/))
test('one-player round rejected',()=>assert.throws(()=>commitRound({...base,stakes:base.stakes.slice(0,1)}),/two stakes/))
test('different rounds produce different commitments',()=>assert.notEqual(commitRound(base).commitment,commitRound({...base,roundId:'round_60'}).commitment))
