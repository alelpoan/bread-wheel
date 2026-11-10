# Bread Wheel — completion plan (audit of 2026-11-10 source snapshot)

## Verified baseline
- Vite/React demo UI and Miden wallet adapter present. Wallet GC balance read and preflight note construction present; production stake transfers disabled.
- MASM stake: owner refund only. Settlement v1: hardcoded winner and refund, no draw verification. Ticket v2: weighted ticket authorization for three participants, but ticket supplied by note creator.
- JS fairness transcript: canonical stake commitment and deterministic weighted selection, but no authenticated entropy or onchain proof.
- MockChain CI for individual prototypes exists. Rust toolchain unavailable in this execution environment; CI results are NOT verified here.

## Release gates — complete in this order
1. **Freeze protocol / compatibility:** pin versions of Miden SDK, wallet adapter, Rust toolchain and reference template; confirm Cedar network selection matches wallet network. Reproduce MASM/MockChain tests against pinned dependencies. Exit: reproducible green CI.
2. **Specify onchain escrow:** define stake note ownership, round binding, unique notes, stake asset ID, lock deadline, settlement window and refunds; prove asset conservation and double-spend exclusion. Exit: tests for 3 independent stakes (1/2/3 GC), rejection of wrong assets and replay.
3. **Trust-minimized entropy:** select a Miden-verifiable post-close source; formally address withholding/last-revealer bias and failure modes. A JS seed, caller-supplied ticket, or unauthenticated block hash does not pass. Exit: contract verifies source authenticity and temporal ordering.
4. **Proof-checked settlement:** verify committed participant set and exact weighted winner *inside the onchain spending authorization*. Winner can spend all eligible notes; others cannot; abort/refund mutually exclusive. Exit: adversarial MockChain tests and full 6-GC payout.
5. **End-to-end network test:** local node -> build/publish artifacts -> 3 wallet accounts -> close -> draw -> payout/refund -> confirm balances and note consumption. Exit: recorded reproducible transactions.
6. **Frontend integration:** only after 1–5, replace demo flow with signed transaction flow, handle pending/reorg/failures, display real state. Exit: no simulated winnings displayed as real; network and asset ID validation.
7. **Release review:** independent security review, limits, monitoring and staged rollout. No production GC before sign-off.

## Important incompatibility
`miden/settlement/round-model.mjs` and `miden/fairness/verify-round.mjs` use different winner-selection transcripts/algorithms. They MUST be unified before onchain integration. This update only fixes offchain settlement authorization in the former; it does not authenticate entropy or change MASM.

## What was changed in this delivery
- Settlement reference model now recomputes the winner from provided entropy and rejects forged participant, commitment, amount, or missing entropy.
- Four adversarial Node tests added. 22 Node tests passed locally.
- Existing UI, wallet, MASM, Rust tests and workflows unchanged.

## NOT DONE / safety
No end-to-end MockChain verification, no onchain randomness proof, no safe GC payouts. Never fund existing experimental note scripts.
