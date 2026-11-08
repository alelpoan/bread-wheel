import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  calculatePot,
  calculateChance,
  calculatePayout
} from './rules.ts'

const bets = [
  { playerId: 1, amount: 10 },
  { playerId: 2, amount: 30 },
  { playerId: 3, amount: 60 }
]

test('Total pot is 100 coins', () => {
  assert.equal(calculatePot(bets), 100)
})

test('Winning chances match stakes', () => {
  assert.equal(calculateChance(bets, 1), 10)
  assert.equal(calculateChance(bets, 2), 30)
  assert.equal(calculateChance(bets, 3), 60)
})

test('Winner receives the full pot without fees', () => {
  assert.equal(calculatePayout(bets, 3), 100)
})

test('Winner receives 95 coins with a 5% fee', () => {
  assert.equal(calculatePayout(bets, 3, 5), 95)
})

test('Player without a bet cannot win', () => {
  assert.throws(() => calculatePayout(bets, 4))
})

test('Negative stakes must be rejected', () => {
  assert.throws(() =>
    calculatePot([{ playerId: 1, amount: -10 }])
  )
})

test('Fractional stakes must be rejected', () => {
  assert.throws(() =>
    calculatePot([{ playerId: 1, amount: 1.5 }])
  )
})

test('Unsafe integer stakes must be rejected', () => {
  assert.throws(() =>
    calculatePot([
      { playerId: 1, amount: Number.MAX_SAFE_INTEGER + 1 }
    ])
  )
})
