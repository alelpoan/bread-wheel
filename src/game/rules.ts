export type Bet = {
  playerId: number
  amount: number
}

function validateBets(bets: Bet[]): void {
  for (const bet of bets) {
    if (!Number.isSafeInteger(bet.playerId) || bet.playerId < 1) {
      throw new Error('Invalid player ID')
    }

    if (!Number.isSafeInteger(bet.amount) || bet.amount <= 0) {
      throw new Error('Invalid stake amount')
    }
  }
}

export function calculatePot(bets: Bet[]): number {
  validateBets(bets)

  let pot = 0

  for (const bet of bets) {
    pot += bet.amount

    if (!Number.isSafeInteger(pot)) {
      throw new Error('Pot exceeds safe integer limit')
    }
  }

  return pot
}

export function calculateChance(
  bets: Bet[],
  playerId: number
): number {
  const pot = calculatePot(bets)
  if (pot === 0) return 0

  const playerBet = bets
    .filter(bet => bet.playerId === playerId)
    .reduce((sum, bet) => sum + bet.amount, 0)

  return (playerBet / pot) * 100
}

export function calculatePayout(
  bets: Bet[],
  winnerId: number,
  feePercent = 0
): number {
  const pot = calculatePot(bets)

  if (!bets.some(bet => bet.playerId === winnerId)) {
    throw new Error('Winner has no bet')
  }

  if (!Number.isFinite(feePercent) ||
      feePercent < 0 ||
      feePercent > 100) {
    throw new Error('Invalid fee')
  }

  return Math.floor(pot * (1 - feePercent / 100))
}
