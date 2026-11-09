//! MockChain tests for Bread Wheel's first stake note.
//! This is a refund-only prototype, not a shared pool or winner settlement.
use anyhow::Result;
use miden_client::{
    account::{Account, AccountId},
    asset::FungibleAsset,
    auth::AuthSchemeId,
    note::{Note, NoteType, PartialNote},
    transaction::{ExecutedTransaction, RawOutputNote},
};
use miden_standards::{code_builder::CodeBuilder, testing::note::NoteBuilder, tx_script::SendNotesTransactionScript};
use miden_testing::{Auth, MockChain};
use rand::{rngs::StdRng, SeedableRng};

const UNIT: u64 = 1_000_000;
const STAKE_MODULE: &str = include_str!("../../masm/bread_stake.masm");
const STAKE_SCRIPT: &str = r#"
use {NoteArgs} from miden::protocol::types
use bread::stake

@note_script
pub proc main(args: NoteArgs)
    exec.stake::refund_owner_after_deadline
end
"#;

fn auth() -> Auth {
    Auth::BasicAuth { auth_scheme: AuthSchemeId::Falcon512Poseidon2 }
}

struct Game {
    chain: MockChain,
    faucet: AccountId,
    owner: Account,
    stranger: Account,
    note: Note,
}

fn setup(refund_after_block: u32) -> Result<Game> {
    let mut builder = MockChain::builder();
    let faucet = builder.add_existing_basic_faucet(auth(), "GC", 1000 * UNIT, None)?.id();
    let owner = builder.add_existing_wallet_with_assets(
        auth(), [FungibleAsset::new(faucet, 3 * UNIT)?.into()],
    )?;
    let stranger = builder.add_existing_wallet_with_assets(
        auth(), [FungibleAsset::new(faucet, UNIT)?.into()],
    )?;
    let chain = builder.build()?;
    let script = CodeBuilder::default()
        .with_linked_module("bread::stake", STAKE_MODULE)?
        .compile_note_script(STAKE_SCRIPT)?;
    let storage = vec![
        owner.id().suffix(),
        owner.id().prefix().as_felt(),
        59u32.into(), // round #59, kept in note commitment
        refund_after_block.into(),
    ];
    let mut rng = StdRng::seed_from_u64(591);
    let note = NoteBuilder::new(owner.id(), &mut rng)
        .script(script)
        .note_storage(storage)?
        .add_assets([FungibleAsset::new(faucet, UNIT)?.into()])
        .note_type(NoteType::Public)
        .build()?;
    Ok(Game { chain, faucet, owner, stranger, note })
}

impl Game {
    async fn publish(&mut self) -> Result<()> {
        let script = SendNotesTransactionScript::new(
            &self.owner.code_interface(),
            &[PartialNote::from(self.note.clone())],
        )?;
        let tx = self.chain.build_transaction(self.owner.id())
            .send_notes_script(&script)
            .expected_output_note(RawOutputNote::Full(self.note.clone()))
            .build()?.execute().await?;
        self.commit(&tx)
    }

    async fn refund(&self, account: AccountId) -> Result<ExecutedTransaction> {
        Ok(self.chain.build_transaction(account)
            .authenticated_input_note(self.note.id())
            .build()?.execute().await?)
    }

    fn commit(&mut self, tx: &ExecutedTransaction) -> Result<()> {
        self.chain.add_pending_executed_transaction(tx)?;
        self.chain.prove_next_block()?;
        Ok(())
    }

    fn balance(&self, account: AccountId) -> u64 {
        let asset_id = FungibleAsset::new(self.faucet, 1).unwrap().id();
        self.chain.committed_account(account).unwrap()
            .vault().get_balance(asset_id).unwrap().as_u64()
    }
}

#[tokio::test(flavor = "multi_thread")]
async fn stake_note_can_be_published() -> Result<()> {
    let mut g = setup(u32::MAX)?;
    let before = g.balance(g.owner.id());
    g.publish().await?;
    assert_eq!(g.balance(g.owner.id()), before - UNIT, "publishing must lock exactly 1 GC");
    assert!(g.refund(g.owner.id()).await.is_err(), "stake must remain locked");
    println!("PASS: stake note published and locked");
    Ok(())
}

#[tokio::test(flavor = "multi_thread")]
async fn owner_cannot_refund_before_deadline() -> Result<()> {
    let mut g = setup(u32::MAX)?;
    g.publish().await?;
    let before = g.balance(g.owner.id());
    assert!(g.refund(g.owner.id()).await.is_err(), "early refund must fail");
    assert_eq!(g.balance(g.owner.id()), before, "failed refund must not change balance");
    println!("PASS: owner cannot refund early");
    Ok(())
}

#[tokio::test(flavor = "multi_thread")]
async fn stranger_cannot_refund_even_after_deadline() -> Result<()> {
    let mut g = setup(0)?;
    g.publish().await?;
    let before = g.balance(g.stranger.id());
    assert!(g.refund(g.stranger.id()).await.is_err(), "stranger refund must fail");
    assert_eq!(g.balance(g.stranger.id()), before);
    println!("PASS: stranger cannot take stake");
    Ok(())
}

#[tokio::test(flavor = "multi_thread")]
async fn owner_can_refund_after_deadline_once() -> Result<()> {
    let mut g = setup(0)?;
    let initial = g.balance(g.owner.id());
    g.publish().await?;
    let before = g.balance(g.owner.id());
    assert_eq!(before, initial - UNIT, "published stake must debit 1 GC");
    let tx = g.refund(g.owner.id()).await?;
    g.commit(&tx)?;
    assert_eq!(g.balance(g.owner.id()), before + UNIT);
    assert_eq!(g.balance(g.owner.id()), initial, "refund must restore initial balance");
    let again = g.refund(g.owner.id()).await;
    if let Ok(tx2) = again {
        assert!(g.commit(&tx2).is_err(), "second refund must not commit");
    }
    assert_eq!(g.balance(g.owner.id()), initial, "second attempt must not mint GC");
    println!("PASS: owner refund 1 GC, no double spend");
    Ok(())
}

// Exercise a nonzero deadline against advancing MockChain reference blocks.
// The chain must reject refunds before the deadline, then permit exactly one
// successful consumption after enough blocks have been produced.
#[tokio::test(flavor = "multi_thread")]
async fn refund_becomes_available_only_after_blocks_advance() -> Result<()> {
    const DEADLINE: u32 = 8;
    let mut g = setup(DEADLINE)?;
    let initial = g.balance(g.owner.id());
    g.publish().await?;
    assert_eq!(g.balance(g.owner.id()), initial - UNIT);

    // Publishing one note must not immediately unlock a future-block refund.
    assert!(g.refund(g.owner.id()).await.is_err(), "future deadline must initially lock the stake");
    assert_eq!(g.balance(g.owner.id()), initial - UNIT);

    let mut successful_refund = None;
    let mut rejected_attempts = 1usize;
    // Empty blocks are intentionally proven to move the chain reference height.
    // The bound avoids a hanging test if the SDK's height semantics change.
    for _ in 0..20 {
        g.chain.prove_next_block()?;
        match g.refund(g.owner.id()).await {
            Ok(tx) => { successful_refund = Some(tx); break; }
            Err(_) => {
                rejected_attempts += 1;
                assert_eq!(g.balance(g.owner.id()), initial - UNIT);
            }
        }
    }
    let tx = successful_refund.expect("refund must become valid after advancing past deadline");
    assert!(rejected_attempts >= 1, "at least one early refund must fail");
    g.commit(&tx)?;
    assert_eq!(g.balance(g.owner.id()), initial, "exactly 1 GC must return to owner");
    let again = g.refund(g.owner.id()).await;
    if let Ok(tx2) = again {
        assert!(g.commit(&tx2).is_err(), "note cannot be consumed twice");
    }
    assert_eq!(g.balance(g.owner.id()), initial);
    println!("PASS: nonzero deadline reached after {rejected_attempts} early rejections");
    Ok(())
}
