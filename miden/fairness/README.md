# Bread Wheel: verifiable draw transcript (offchain reference only)

This package is **not a MASM contract** and **does not enable real GC**. It creates a canonical commitment to a closed set of stake notes, then deterministically selects a weighted winner using a 32-byte random value that must originate *after* betting closes. It tests tampering, duplicate notes, late randomness, amount overflow, and ordering invariance.

## Critical unsolved security requirements

1. **Independent, authenticated randomness.** The caller currently supplies `randomnessHex`; an operator can grind seeds and choose a favorable winner. The `randomnessBlock` number is caller-supplied and is not authenticated. A verified beacon / randomness proof with liveness guarantees is required.
2. **Onchain enforcement.** This JS verifier does not prove anything to MASM. Need a Miden-verifiable proof of the exact closed stake set, draw transcript, and winning account, tied to a single round state. Hash algorithm and encoding must be supported in MASM or proven in a compatible verification system.
3. **Funds custody and liveness.** Existing notes precommit a winner before bets close. Do not fund. Need safe onchain payout/refund rights and cancellation, with no double-spend, including when operator disappears.
4. **Source of truth.** Round inclusion must be derived from finalized notes, not a server-provided arbitrary list. Define inclusion deadline and late-note refund.
5. **Protocol compatibility.** This reference uses SHA-256. It is **not** assumed to match the Miden VM hash primitive. Do not use its commitment as an onchain commitment without explicit implementation and verification.

The next deliverable should be an actual MASM verifier and MockChain tests that demonstrate onchain enforcement of a cryptographically authenticated result, followed by a test-network lifecycle and security review.
