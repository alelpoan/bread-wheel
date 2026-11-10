# Bread Wheel: onchain release gate

This patch is an integration/reference test bundle, **not a finished onchain game**.

Current MASM weighted-ticket module authorizes a claimant against a ticket **supplied by the note author**. The module does not authenticate randomness. Passing MockChain does not make it safe to fund.

The JS round engine's `verifyEntropyProof` callback is a trust boundary and tests use a `()=>true` stub. No real verifier is implemented.

## Required before enabling Gamecoin

1. An agreed Miden-compatible trust-minimized randomness protocol, with post-close proof verification by the actual spending transaction, including abort-bias handling.
2. A proven way to commit independently deposited notes to the exact round transcript and ensure all participants can verify membership and amounts.
3. A Miden account/note architecture permitting one authorized payout of the entire pool and owner-only timeout refunds, with no double spends across branches.
4. Real asset movement tests across three independently funded accounts on the pinned Miden SDK and RPC network, verifying receipt and balance deltas, reorg/error handling.
5. Threat review, third-party review for valuable GC, and explicit opt-in to enable transfers.

The package intentionally does not change any wallet transaction code, live GC gating, or deploy artifacts.
