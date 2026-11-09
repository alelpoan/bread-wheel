# Bread Wheel settlement — reference model, NOT a deployed smart contract

This package adds an isolated, executable settlement state-machine model and tests. It does **not** change the roulette UI, the existing stake.masm, compiled stake-note.bin, or any wallet transfer setting.

## Why real stakes are still disabled

The existing `stake.masm` only allows the original owner to refund after a deadline. It has no authenticated winner settlement branch. A local JS calculation cannot authorize consumption of another user's Miden Note. To implement a safe on-chain pool we must first choose and implement a Miden-compatible custody/authorization scheme, verify an unbiasable entropy source and its finality, and ensure the settlement/refund branches are mutually exclusive on-chain. A single note whose refund is unconditionally allowed after a deadline can conflict with an unconfirmed settlement. Those invariants must be enforced by MASM, not by this JS model.

## What is implemented

- Unique stake-note IDs and immutable canonical stake ordering
- Integer GC base-unit arithmetic via BigInt
- Stake-weighted deterministic selection using SHA-256 and rejection sampling
- Round closure, settlement/cancellation states
- Deadline enforcement, owner-only refunds, no double consumption
- Six automated tests using Node's built-in test runner

## Explicit gaps

- Miden MASM payout/escrow contract and proving tests
- On-chain binding of the committed stake set and winner
- Cryptographically verified, manipulation-resistant entropy and reveal liveness
- Atomic settlement of multiple notes and on-chain exclusivity with refunds
- Real-wallet signature flow and end-to-end Cedar testing

Run `node --test miden/settlement/round-model.test.mjs`. The model is an executable specification for implementing the MASM settlement, **not a payment engine**.
