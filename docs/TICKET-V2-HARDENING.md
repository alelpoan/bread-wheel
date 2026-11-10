# Ticket V2 hardening — 2026-11-10

## Actual change
The MASM ticket authorization now rejects zero stake weights for any of the three participants. The Rust MockChain integration test includes three zero-weight rejection scenarios. The existing boundary tests remain.

## What is actually tested here
`node scripts/check_ticket_v2.mjs` checks source-level invariants only; it does **not** compile MASM or execute MockChain. Existing JS reference suites also run. The Rust test must be executed in the pinned GitHub Actions workflow; no Rust toolchain is installed in this execution environment.

## Still not a real-money escrow
The test creates a **single six-GC note funded by its owner**. It does NOT transfer 1+2+3 GC from three independent players, authenticate the ticket, or verify a post-close randomness proof. It does not implement a trustless full round. Never fund this script with real Gamecoin.

## Next actual chain milestone
Implement and test independent player stake-note deposits, canonical round close and commitment, authenticated post-close randomness, onchain proof-checked payout/refund. Do not connect the UI to GC transfers before those pass.
