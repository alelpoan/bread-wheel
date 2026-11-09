#!/usr/bin/env python3
"""Fail closed if the stake tests/build stop referring to the actual contract."""
from pathlib import Path
import re
import sys

root = Path(__file__).resolve().parents[1]
stake = root / 'miden/masm/stake.masm'
test = root / 'miden/tests/wheel_stake_test.rs'
build = root / '.github/workflows/bread-masm.yml'
stake_ci = root / '.github/workflows/bread-stake-test.yml'
errors = []
for f in (stake, test, build, stake_ci):
    if not f.is_file(): errors.append(f'Missing: {f.relative_to(root)}')
if errors:
    print('\n'.join(errors)); sys.exit(1)
s, t, b, ci = (f.read_text(encoding='utf-8-sig') for f in (stake,test,build,stake_ci))
if 'pub proc refund_owner_after_deadline' not in s:
    errors.append('stake.masm missing refund_owner_after_deadline')
if 'exec.stake::refund_owner_after_deadline' not in b:
    errors.append('MASM workflow does not compile the refund entrypoint')
if 'exec.stake::valid_stake' in b:
    errors.append('MASM workflow still calls removed valid_stake')
if 'exec.stake::refund_owner_after_deadline' not in t:
    errors.append('MockChain test does not call refund entrypoint')
if 'include_str!("../../masm/bread_stake.masm")' not in t:
    errors.append('MockChain test source path changed; verify copied module')
if 'cp miden/masm/stake.masm geoquizz-reference/masm/bread_stake.masm' not in ci:
    errors.append('MockChain workflow no longer copies current stake.masm into test fixture')
if 'cargo +nightly-2026-09-01 test --test wheel_stake_test' not in ci:
    errors.append('MockChain workflow does not execute wheel_stake_test')
for test_name in ('stake_note_can_be_published','owner_cannot_refund_before_deadline',
                  'stranger_cannot_refund_even_after_deadline','owner_can_refund_after_deadline_once'):
    if not re.search(r'async fn\s+'+test_name+r'\s*\(',t):
        errors.append(f'Missing expected test: {test_name}')
if errors:
    print('STAKE INTEGRITY FAILED:')
    for err in errors: print(' -',err)
    sys.exit(1)
print('PASS: workflow references, contract entrypoint, and four test declarations are aligned.')
print('NOTE: This is a static integrity check, NOT local-node validation or approval for real GC.')
