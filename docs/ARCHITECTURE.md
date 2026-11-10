# Bread Wheel state machine — reference only

```
OPEN (accept stake notes until closeBlock)
  -> CLOSED (immutable canonical note transcript commitment)
     -> SETTLED (only if proof verifier authenticates entropy from > closeBlock;
                 winner derived from transcript; all notes marked consumed)
     -> CANCELLED (only after refundBlock; each owner refunds once)
```

Conservation: all stakes are BigInt base units, bounded by u64. Total settled equals sum of stakes. Every noteId is unique; each can be marked consumed at most once. Settlement and cancellation are mutually exclusive. Canonical transcript binds noteId, owner, amount, roundId and deadlines.

**Important:** These invariants currently hold only inside a single JavaScript process. They are not blockchain invariants. A JavaScript caller can supply a malicious verifier; a production implementation must verify randomness and all spend conditions **inside the onchain protocol**, and ensure the settlement and refund paths cannot both spend the same note.
