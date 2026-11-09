/** Bread Wheel round arithmetic. Pure, deterministic, no wallet or random winner selection. */
export type RoundBet = { account: string; amountBaseUnits: bigint }
export type RoundEntry = { account: string; amountBaseUnits: bigint; chanceBps: number }
export type RoundSummary = {
  totalBaseUnits: bigint
  entries: RoundEntry[]
  participantCount: number
  canSpin: boolean
  soleWinner: string | null
}

/** Groups repeat bets from the same account and computes display-only basis points. */
export function summarizeRound(bets: readonly RoundBet[]): RoundSummary {
  const byAccount = new Map<string, bigint>()
  for (const bet of bets) {
    if (!bet.account.trim()) throw new Error('Missing account')
    if (bet.amountBaseUnits <= 0n) throw new Error('Stake must be positive')
    byAccount.set(bet.account, (byAccount.get(bet.account) ?? 0n) + bet.amountBaseUnits)
  }
  const totalBaseUnits = [...byAccount.values()].reduce((sum, v) => sum + v, 0n)
  const entries = [...byAccount].map(([account, amountBaseUnits]) => ({
    account,
    amountBaseUnits,
    chanceBps: totalBaseUnits === 0n ? 0 : Number(amountBaseUnits * 10_000n / totalBaseUnits),
  }))
  return {
    totalBaseUnits,
    entries,
    participantCount: entries.length,
    canSpin: entries.length > 0,
    soleWinner: entries.length === 1 ? entries[0].account : null,
  }
}

/** Returns a winner for an already verified, unbiased integer draw in [0, total). */
export function winnerFromVerifiedDraw(bets: readonly RoundBet[], draw: bigint): string {
  const summary = summarizeRound(bets)
  if (summary.totalBaseUnits === 0n) throw new Error('No stakes')
  if (draw < 0n || draw >= summary.totalBaseUnits) throw new Error('Draw outside pool')
  let cursor = 0n
  for (const entry of summary.entries) {
    cursor += entry.amountBaseUnits
    if (draw < cursor) return entry.account
  }
  throw new Error('Unreachable draw')
}

export function formatGamecoin(baseUnits: bigint): string {
  const sign = baseUnits < 0n ? '-' : ''
  const abs = baseUnits < 0n ? -baseUnits : baseUnits
  const fraction = (abs % 1_000_000n).toString().padStart(6, '0').replace(/0+$/, '')
  return `${sign}${abs / 1_000_000n}${fraction ? '.' + fraction : ''}`
}
