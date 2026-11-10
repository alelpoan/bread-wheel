//! Test that the note script selects a recipient from weighted ticket intervals.
//! NOT a secure randomness implementation: ticket is committed by note creator.
use anyhow::Result;
use miden_client::{account::{Account, AccountId}, asset::FungibleAsset, auth::AuthSchemeId, note::{Note, NoteType, PartialNote}, transaction::{ExecutedTransaction, RawOutputNote}};
use miden_standards::{code_builder::CodeBuilder, testing::note::NoteBuilder, tx_script::SendNotesTransactionScript};
use miden_testing::{Auth, MockChain};
use rand::{rngs::StdRng, SeedableRng};

const MODULE: &str = include_str!("../../masm/bread_ticket_v2.masm");
const SCRIPT: &str = r#"
use {NoteArgs} from miden::protocol::types
use bread::ticket
@note_script
pub proc main(args: NoteArgs)
    exec.ticket::claim_ticket_winner
end
"#;
fn auth() -> Auth { Auth::BasicAuth { auth_scheme: AuthSchemeId::Falcon512Poseidon2 } }
fn bal(chain: &MockChain, faucet: AccountId, id: AccountId) -> u64 {
    let asset = FungibleAsset::new(faucet, 1).unwrap().id();
    chain.committed_account(id).unwrap().vault().get_balance(asset).unwrap().as_u64()
}
fn commit(chain: &mut MockChain, tx: &ExecutedTransaction) -> Result<()> {
    chain.add_pending_executed_transaction(tx)?;
    chain.prove_next_block()?;
    Ok(())
}
async fn scenario_with_weights(ticket: u32, weights: [u32; 3], expected: Option<usize>) -> Result<()> {
    let mut b = MockChain::builder();
    let faucet = b.add_existing_basic_faucet(auth(), "GC", 1000_000_000, None)?.id();
    let owner = b.add_existing_wallet_with_assets(auth(), [FungibleAsset::new(faucet, 6_000_000)?.into()])?;
    let mut players: Vec<Account> = Vec::new();
    for _ in 0..3 { players.push(b.add_existing_wallet_with_assets(auth(), [FungibleAsset::new(faucet, 1_000_000)?.into()])?); }
    let mut chain = b.build()?;
    let script = CodeBuilder::default().with_linked_module("bread::ticket", MODULE)?.compile_note_script(SCRIPT)?;
    let mut storage = vec![owner.id().suffix(), owner.id().prefix().as_felt()];
    for p in &players { storage.extend([p.id().suffix(), p.id().prefix().as_felt()]); }
    storage.extend([weights[0], weights[1], weights[2], ticket].map(miden_client::Felt::from));
    let mut rng = StdRng::seed_from_u64(20261110 + ticket as u64);
    let note = NoteBuilder::new(owner.id(), &mut rng).script(script).note_storage(storage)?
        .add_assets([FungibleAsset::new(faucet, 6_000_000)?.into()]).note_type(NoteType::Public).build()?;
    let send = SendNotesTransactionScript::new(&owner.code_interface(), &[PartialNote::from(note.clone())])?;
    let publish = chain.build_transaction(owner.id()).send_notes_script(&send)
        .expected_output_note(RawOutputNote::Full(note.clone())).build()?.execute().await?;
    commit(&mut chain, &publish)?;
    for (i,p) in players.iter().enumerate() {
        let result = chain.build_transaction(p.id()).authenticated_input_note(note.id()).build()?.execute().await;
        if Some(i) == expected {
            let tx = result?;
            let before = bal(&chain, faucet, p.id());
            commit(&mut chain, &tx)?;
            assert_eq!(bal(&chain, faucet, p.id()), before + 6_000_000);
            return Ok(());
        } else { assert!(result.is_err(), "unauthorized player {i} spent ticket {ticket}"); }
    }
    assert!(expected.is_none());
    Ok(())
}
async fn scenario(ticket: u32, expected: Option<usize>) -> Result<()> {
    scenario_with_weights(ticket, [1, 2, 3], expected).await
}

#[tokio::test(flavor="multi_thread")]
async fn rejects_zero_weight_participants() -> Result<()> {
    scenario_with_weights(0, [0, 2, 3], None).await?;
    scenario_with_weights(0, [1, 0, 3], None).await?;
    scenario_with_weights(0, [1, 2, 0], None).await?;
    Ok(())
}

#[tokio::test(flavor="multi_thread")]
async fn weighted_ticket_boundaries() -> Result<()> {
    scenario(0,Some(0)).await?;
    scenario(1,Some(1)).await?;
    scenario(2,Some(1)).await?;
    scenario(3,Some(2)).await?;
    scenario(5,Some(2)).await?;
    scenario(6,None).await?;
    Ok(())
}
