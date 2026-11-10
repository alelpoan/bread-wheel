# Bread Wheel — implementation status, 2026-11-10

## Basis
Full project source archive `bread-wheel-final-source.zip`, containing 77 entries, at commit `6eeb482` (Ticket V2). Applied the already tested `bread-wheel-audit-fix` to the bundled snapshot, then added a complete **off-chain reference round engine** with 3-player settlement, proof-verifier interface, refunds, transcript integrity and 10 adversarial tests.

## Verified in this environment
- Node 22: `node --test miden/protocol/*.test.mjs miden/fairness/*.test.mjs miden/settlement/*.test.mjs` — **32/32 pass**.
- Code does not sign transactions, transfer GC, or modify the existing UI.

## NOT verified or implemented
- No Rust toolchain or Miden local node was available in the execution environment. Existing MockChain tests have not been rerun here.
- The new reference engine is **JavaScript only**, not a MASM implementation.
- `verifyEntropyProof` is an interface, not a real verifier. In tests, `() => true` is deliberately used as a TEST STUB. It MUST NOT be used to authorize transfers.
- No authenticated post-close randomness source was implemented or independently verified.
- No trustless multi-note settlement, aggregate custody or proof-checked payout was implemented onchain.
- The reference engine uses a new V2 SHA-256 transcript. The existing `miden/fairness/verify-round.mjs` uses another domain/encoding. These must be reconciled with a single onchain-verifiable specification before deployment.
- No full round on a local Miden node or through Bread Wallet was executed.

## Remaining critical path (ordered)
1. Select and demonstrate an authenticated post-close entropy primitive that the chosen Miden version can verify in MASM (and handle withholding/liveness). Document trust assumptions and proof format.
2. Specify a **single** canonical serialization, domain separation, hash and winner algorithm compatible with Miden VM primitives; remove divergent algorithms.
3. Implement stake note + round commitment + permissionless settlement + refund rules in MASM with note ownership/asset conservation and anti-double-spend guarantees. Prove that multiple notes can be consumed under the chosen model.
4. Run full adversarial MockChain tests: 3 real note assets 1/2/3 GC -> winner receives 6 GC; timeout refunds; wrong winner/proof/duplicate claim/late stake all fail.
5. Run the exact artifacts on a local Miden node and verify final account balances and note consumption.
6. Integrate wallet transaction requests, signing, confirmation, and recovery UX in the existing React UI without changing its visual design.
7. Independent security review before funding; keep real GC disabled until all steps pass.

## Security decision
**NOT READY FOR REAL GAMECOIN.** The off-chain test success is not evidence of onchain safety. Do not remove the existing safety gate or fund experimental notes.
