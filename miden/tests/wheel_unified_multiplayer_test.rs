//! Bread Wheel: three independent stakes paid to one committed recipient.
//! This is a MockChain integration test of transfer mechanics ONLY.
//! The winner is NOT authenticated by the protocol; do not fund this script.
use anyhow::Result;
use miden_client::{account::{Account, AccountId}, asset::FungibleAsset, auth::AuthSchemeId, note::{Note, NoteType, PartialNote}, transaction::{ExecutedTransaction, RawOutputNote}};
use miden_standards::{code_builder::CodeBuilder, testing::note::NoteBuilder, tx_script::SendNotesTransactionScript};
use miden_testing::{Auth, MockChain};
use rand::{rngs::StdRng, SeedableRng};

const UNIT: u64 = 1_000_000;
const MODULE: &str = include_str!("../../masm/bread_settlement_v1.masm");
const UNIFIED_SCRIPT: &str = r#"
use {NoteArgs} from miden::protocol::types
use miden::protocol::active_note
use miden::protocol::tx
use bread::settlement
@note_script
pub proc main(args: NoteArgs)
    # Single script root, same for winner and refund.
    push.7 push.0
    exec.active_note::get_bounded_storage
    eq.7 assert
    # Before expiry only the precommitted winner may spend.
    # At/after expiry only the original owner may spend.
    exec.tx::get_reference_block_number
    mem_load.6
    lt
    if.true
        exec.settlement::claim_committed_winner
    else
        exec.settlement::refund_owner_after_expiry
    end
end
"#;
fn auth() -> Auth { Auth::BasicAuth { auth_scheme: AuthSchemeId::Falcon512Poseidon2 } }
fn balance(chain: &MockChain, faucet: AccountId, id: AccountId) -> u64 {
    let asset = FungibleAsset::new(faucet, 1).unwrap().id();
    chain.committed_account(id).unwrap().vault().get_balance(asset).unwrap().as_u64()
}
fn commit(chain: &mut MockChain, tx: &ExecutedTransaction) -> Result<()> {
    chain.add_pending_executed_transaction(tx)?;
    chain.prove_next_block()?;
    Ok(())
}
async fn publish(chain: &mut MockChain, owner: &Account, note: &Note) -> Result<()> {
    let script = SendNotesTransactionScript::new(&owner.code_interface(), &[PartialNote::from(note.clone())])?;
    let tx = chain.build_transaction(owner.id()).send_notes_script(&script)
        .expected_output_note(RawOutputNote::Full(note.clone())).build()?.execute().await?;
    commit(chain, &tx)
}
#[tokio::test(flavor = "multi_thread")]
async fn three_stakes_can_be_claimed_by_same_recipient_without_double_spend() -> Result<()> {
    let mut builder = MockChain::builder();
    let faucet = builder.add_existing_basic_faucet(auth(), "GC", 1000 * UNIT, None)?.id();
    let mut owners = Vec::new();
    for _ in 0..3 {
        owners.push(builder.add_existing_wallet_with_assets(auth(), [FungibleAsset::new(faucet, 5 * UNIT)?.into()])?);
    }
    let winner = builder.add_existing_wallet_with_assets(auth(), [FungibleAsset::new(faucet, UNIT)?.into()])?;
    let outsider = builder.add_existing_wallet_with_assets(auth(), [FungibleAsset::new(faucet, UNIT)?.into()])?;
    let mut chain = builder.build()?;
    let script = CodeBuilder::default().with_linked_module("bread::settlement", MODULE)?.compile_note_script(UNIFIED_SCRIPT)?;
    let mut rng = StdRng::seed_from_u64(20261109);
    let mut notes = Vec::new();
    let initial_winner = balance(&chain, faucet, winner.id());
    for (i, owner) in owners.iter().enumerate() {
        let storage = vec![owner.id().suffix(), owner.id().prefix().as_felt(), winner.id().suffix(), winner.id().prefix().as_felt(), 59u32.into(), 0u32.into(), u32::MAX.into()];
        let note = NoteBuilder::new(owner.id(), &mut rng).script(script.clone()).note_storage(storage)?
            .add_assets([FungibleAsset::new(faucet, (i as u64 + 1) * UNIT)?.into()])
            .note_type(NoteType::Public).build()?;
        publish(&mut chain, owner, &note).await?;
        notes.push(note);
    }
    assert_eq!(notes.len(), 3);
    // Only the precommitted winner may spend any of the notes.
    for note in &notes {
        assert!(chain.build_transaction(outsider.id()).authenticated_input_note(note.id()).build()?.execute().await.is_err());
    }
    for note in &notes {
        let tx = chain.build_transaction(winner.id()).authenticated_input_note(note.id()).build()?.execute().await?;
        commit(&mut chain, &tx)?;
    }
    assert_eq!(balance(&chain, faucet, winner.id()), initial_winner + 6 * UNIT);
    // A committed spend cannot be committed again.
    for note in &notes {
        if let Ok(tx) = chain.build_transaction(winner.id()).authenticated_input_note(note.id()).build()?.execute().await {
            assert!(commit(&mut chain, &tx).is_err());
        }
    }
    assert_eq!(balance(&chain, faucet, winner.id()), initial_winner + 6 * UNIT);
    Ok(())
}
