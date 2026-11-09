//! Experimental settlement note: MockChain execution tests. DO NOT FUND.
use anyhow::Result;
use miden_client::{account::{Account, AccountId}, asset::FungibleAsset, auth::AuthSchemeId, note::{Note, NoteType, PartialNote}, transaction::{ExecutedTransaction, RawOutputNote}};
use miden_standards::{code_builder::CodeBuilder, testing::note::NoteBuilder, tx_script::SendNotesTransactionScript};
use miden_testing::{Auth, MockChain};
use rand::{rngs::StdRng, SeedableRng};

const UNIT: u64 = 1_000_000;
const MODULE: &str = include_str!("../../masm/bread_settlement_v1.masm");
const WINNER_SCRIPT: &str = r#"
use {NoteArgs} from miden::protocol::types
use bread::settlement
@note_script
pub proc main(args: NoteArgs)
    exec.settlement::claim_committed_winner
end
"#;
const REFUND_SCRIPT: &str = r#"
use {NoteArgs} from miden::protocol::types
use bread::settlement
@note_script
pub proc main(args: NoteArgs)
    exec.settlement::refund_owner_after_expiry
end
"#;
fn auth() -> Auth { Auth::BasicAuth { auth_scheme: AuthSchemeId::Falcon512Poseidon2 } }
struct Game { chain: MockChain, faucet: AccountId, owner: Account, winner: Account, outsider: Account, note: Note }
fn setup(start: u32, deadline: u32, winner_path: bool) -> Result<Game> {
    let mut builder = MockChain::builder();
    let faucet = builder.add_existing_basic_faucet(auth(), "GC", 1000 * UNIT, None)?.id();
    let owner = builder.add_existing_wallet_with_assets(auth(), [FungibleAsset::new(faucet, 3 * UNIT)?.into()])?;
    let winner = builder.add_existing_wallet_with_assets(auth(), [FungibleAsset::new(faucet, UNIT)?.into()])?;
    let outsider = builder.add_existing_wallet_with_assets(auth(), [FungibleAsset::new(faucet, UNIT)?.into()])?;
    let chain = builder.build()?;
    let script = CodeBuilder::default().with_linked_module("bread::settlement", MODULE)?
        .compile_note_script(if winner_path { WINNER_SCRIPT } else { REFUND_SCRIPT })?;
    let storage = vec![owner.id().suffix(), owner.id().prefix().as_felt(), winner.id().suffix(), winner.id().prefix().as_felt(), 59u32.into(), start.into(), deadline.into()];
    let mut rng = StdRng::seed_from_u64(591);
    let note = NoteBuilder::new(owner.id(), &mut rng).script(script).note_storage(storage)?
        .add_assets([FungibleAsset::new(faucet, UNIT)?.into()]).note_type(NoteType::Public).build()?;
    Ok(Game { chain, faucet, owner, winner, outsider, note })
}
impl Game {
    async fn publish(&mut self) -> Result<()> {
        let script = SendNotesTransactionScript::new(&self.owner.code_interface(), &[PartialNote::from(self.note.clone())])?;
        let tx = self.chain.build_transaction(self.owner.id()).send_notes_script(&script)
            .expected_output_note(RawOutputNote::Full(self.note.clone())).build()?.execute().await?;
        self.commit(&tx)
    }
    async fn spend(&self, id: AccountId) -> Result<ExecutedTransaction> {
        Ok(self.chain.build_transaction(id).authenticated_input_note(self.note.id()).build()?.execute().await?)
    }
    fn commit(&mut self, tx: &ExecutedTransaction) -> Result<()> { self.chain.add_pending_executed_transaction(tx)?; self.chain.prove_next_block()?; Ok(()) }
    fn balance(&self, id: AccountId) -> u64 {
        let asset = FungibleAsset::new(self.faucet, 1).unwrap().id();
        self.chain.committed_account(id).unwrap().vault().get_balance(asset).unwrap().as_u64()
    }
}
#[tokio::test(flavor="multi_thread")]
async fn winner_can_claim_only_in_window() -> Result<()> {
    let mut g = setup(0, u32::MAX, true)?;
    let initial = g.balance(g.winner.id());
    g.publish().await?;
    assert!(g.spend(g.outsider.id()).await.is_err());
    assert!(g.spend(g.owner.id()).await.is_err());
    let tx = g.spend(g.winner.id()).await?;
    g.commit(&tx)?;
    assert_eq!(g.balance(g.winner.id()), initial + UNIT);
    if let Ok(tx2) = g.spend(g.winner.id()).await { assert!(g.commit(&tx2).is_err()); }
    assert_eq!(g.balance(g.winner.id()), initial + UNIT);
    Ok(())
}
#[tokio::test(flavor="multi_thread")]
async fn winner_cannot_claim_before_start() -> Result<()> {
    let mut g = setup(u32::MAX, u32::MAX, true)?;
    g.publish().await?;
    assert!(g.spend(g.winner.id()).await.is_err());
    Ok(())
}
#[tokio::test(flavor="multi_thread")]
async fn winner_cannot_claim_after_expiry() -> Result<()> {
    let mut g = setup(0, 0, true)?;
    g.publish().await?;
    assert!(g.spend(g.winner.id()).await.is_err());
    Ok(())
}
#[tokio::test(flavor="multi_thread")]
async fn owner_can_refund_only_after_expiry() -> Result<()> {
    let mut g = setup(0, 0, false)?;
    let initial = g.balance(g.owner.id());
    g.publish().await?;
    assert_eq!(g.balance(g.owner.id()), initial - UNIT);
    assert!(g.spend(g.winner.id()).await.is_err());
    assert!(g.spend(g.outsider.id()).await.is_err());
    let tx = g.spend(g.owner.id()).await?;
    g.commit(&tx)?;
    assert_eq!(g.balance(g.owner.id()), initial);
    if let Ok(tx2) = g.spend(g.owner.id()).await { assert!(g.commit(&tx2).is_err()); }
    Ok(())
}
#[tokio::test(flavor="multi_thread")]
async fn owner_cannot_refund_early() -> Result<()> {
    let mut g = setup(0, u32::MAX, false)?;
    g.publish().await?;
    assert!(g.spend(g.owner.id()).await.is_err());
    Ok(())
}
