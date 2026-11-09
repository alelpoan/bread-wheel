use anyhow::Result;
use miden_client::{
    account::{Account, AccountId},
    asset::FungibleAsset,
    auth::AuthSchemeId,
    note::{Note, NoteType, PartialNote},
    transaction::{ExecutedTransaction, RawOutputNote},
};
use miden_standards::{
    code_builder::CodeBuilder,
    testing::note::NoteBuilder,
    tx_script::SendNotesTransactionScript,
};
use miden_testing::{Auth, MockChain};
use rand::{rngs::StdRng, SeedableRng};

const UNIT: u64 = 1_000_000;
const CLAIM_MODULE: &str = include_str!("../../masm/bread_claim.masm");

const CLAIM_SCRIPT: &str = r#"
use {NoteArgs} from miden::protocol::types
use bread::claim

@note_script
pub proc main(args: NoteArgs)
    exec.claim::claim_owner
end
"#;

fn auth() -> Auth {
    Auth::BasicAuth {
        auth_scheme: AuthSchemeId::Falcon512Poseidon2,
    }
}

struct TestGame {
    chain: MockChain,
    faucet: AccountId,
    owner: Account,
    stranger: Account,
    note: Note,
}

fn setup() -> Result<TestGame> {
    let mut builder = MockChain::builder();
    let faucet = builder
        .add_existing_basic_faucet(auth(), "GC", 1000 * UNIT, None)?
        .id();

    let owner = builder.add_existing_wallet_with_assets(
        auth(),
        [FungibleAsset::new(faucet, 2 * UNIT)?.into()],
    )?;

    let stranger = builder.add_existing_wallet_with_assets(
        auth(),
        [FungibleAsset::new(faucet, UNIT)?.into()],
    )?;

    let chain = builder.build()?;

    let script = CodeBuilder::default()
        .with_linked_module("bread::claim", CLAIM_MODULE)?
        .compile_note_script(CLAIM_SCRIPT)?;

    // MASM expects suffix at memory[0], prefix at memory[1].
    let storage = vec![
        owner.id().suffix(),
        owner.id().prefix().as_felt(),
    ];

    let mut rng = StdRng::seed_from_u64(42);
    let note = NoteBuilder::new(owner.id(), &mut rng)
        .script(script)
        .note_storage(storage)?
        .add_assets([FungibleAsset::new(faucet, UNIT)?.into()])
        .note_type(NoteType::Public)
        .build()?;

    Ok(TestGame {
        chain,
        faucet,
        owner,
        stranger,
        note,
    })
}

impl TestGame {
    async fn publish(&mut self) -> Result<()> {
        let script = SendNotesTransactionScript::new(
            &self.owner.code_interface(),
            &[PartialNote::from(self.note.clone())],
        )?;

        let executed = self.chain
            .build_transaction(self.owner.id())
            .send_notes_script(&script)
            .expected_output_note(RawOutputNote::Full(self.note.clone()))
            .build()?
            .execute()
            .await?;

        self.commit(&executed)
    }

    async fn claim(&self, account: AccountId) -> Result<ExecutedTransaction> {
        let tx = self.chain
            .build_transaction(account)
            .authenticated_input_note(self.note.id())
            .build()?;

        Ok(tx.execute().await?)
    }

    fn commit(&mut self, tx: &ExecutedTransaction) -> Result<()> {
        self.chain.add_pending_executed_transaction(tx)?;
        self.chain.prove_next_block()?;
        Ok(())
    }

    fn balance(&self, account: AccountId) -> u64 {
        let id = FungibleAsset::new(self.faucet, 1).unwrap().id();
        self.chain
            .committed_account(account)
            .unwrap()
            .vault()
            .get_balance(id)
            .unwrap()
            .as_u64()
    }
}

#[tokio::test(flavor = "multi_thread")]
async fn owner_can_claim_one_gc() -> Result<()> {
    let mut game = setup()?;
    game.publish().await?;

    let before = game.balance(game.owner.id());
    let executed = game.claim(game.owner.id()).await?;
    game.commit(&executed)?;

    assert_eq!(game.balance(game.owner.id()), before + UNIT);
    println!("PASS: owner received 1 test GC");
    Ok(())
}

#[tokio::test(flavor = "multi_thread")]
async fn stranger_cannot_claim() -> Result<()> {
    let mut game = setup()?;
    game.publish().await?;

    let before = game.balance(game.stranger.id());
    let result = game.claim(game.stranger.id()).await;

    assert!(result.is_err(), "stranger must not claim owner's GC");
    assert_eq!(game.balance(game.stranger.id()), before);
    println!("PASS: stranger rejected");
    Ok(())
}

#[tokio::test(flavor = "multi_thread")]
async fn note_cannot_be_claimed_twice() -> Result<()> {
    let mut game = setup()?;
    game.publish().await?;

    let first = game.claim(game.owner.id()).await?;
    game.commit(&first)?;

    let second = game.claim(game.owner.id()).await;

    match second {
        Err(_) => {
            println!("PASS: second execution rejected");
        }
        Ok(executed) => {
            let result = game.commit(&executed);
            assert!(
                result.is_err(),
                "SECURITY FAILURE: second claim was committed"
            );
            println!("PASS: second claim rejected at commitment");
        }
    }
    Ok(())
}
#[tokio::test(flavor = "multi_thread")]
async fn two_players_one_transaction_two_gc_to_winner() -> Result<()> {
    let mut game = setup()?;

    // Player A publishes the first 1 GC stake.
    game.publish().await?;

    // Player B creates a second 1 GC stake.
    // Both notes name player A as the test recipient.
    let script = CodeBuilder::default()
        .with_linked_module("bread::claim", CLAIM_MODULE)?
        .compile_note_script(CLAIM_SCRIPT)?;

    let storage = vec![
        game.owner.id().suffix(),
        game.owner.id().prefix().as_felt(),
    ];

    let mut rng = StdRng::seed_from_u64(98765);

    let second_note = NoteBuilder::new(game.stranger.id(), &mut rng)
        .script(script)
        .note_storage(storage)?
        .add_assets([FungibleAsset::new(game.faucet, UNIT)?.into()])
        .note_type(NoteType::Public)
        .build()?;

    let send_script = SendNotesTransactionScript::new(
        &game.stranger.code_interface(),
        &[PartialNote::from(second_note.clone())],
    )?;

    let published = game.chain
        .build_transaction(game.stranger.id())
        .send_notes_script(&send_script)
        .expected_output_note(RawOutputNote::Full(second_note.clone()))
        .build()?
        .execute()
        .await?;

    game.commit(&published)?;

    // One transaction consumes BOTH notes.
    let before = game.balance(game.owner.id());

    let payout = game.chain
        .build_transaction(game.owner.id())
        .authenticated_input_note(game.note.id())
        .authenticated_input_note(second_note.id())
        .build()?
        .execute()
        .await?;

    game.commit(&payout)?;

    assert_eq!(
        game.balance(game.owner.id()),
        before + 2 * UNIT,
        "Winner must receive exactly 2 GC"
    );

    println!("PASS: two players funded two notes");
    println!("PASS: one transaction consumed both notes");
    println!("PASS: winner received exactly 2 test GC");

    Ok(())
}
// Security boundary: two notes with different recipients are NOT a shared pot.
// A player cannot take the other player's note merely by grouping them in one tx.
#[tokio::test(flavor = "multi_thread")]
async fn mixed_recipient_notes_cannot_be_claimed_as_one_pot() -> Result<()> {
    let mut game = setup()?;
    game.publish().await?;

    let script = CodeBuilder::default()
        .with_linked_module("bread::claim", CLAIM_MODULE)?
        .compile_note_script(CLAIM_SCRIPT)?;

    let storage = vec![
        game.stranger.id().suffix(),
        game.stranger.id().prefix().as_felt(),
    ];
    let mut rng = StdRng::seed_from_u64(20261109);
    let stranger_note = NoteBuilder::new(game.stranger.id(), &mut rng)
        .script(script)
        .note_storage(storage)?
        .add_assets([FungibleAsset::new(game.faucet, UNIT)?.into()])
        .note_type(NoteType::Public)
        .build()?;

    let send_script = SendNotesTransactionScript::new(
        &game.stranger.code_interface(),
        &[PartialNote::from(stranger_note.clone())],
    )?;
    let published = game.chain
        .build_transaction(game.stranger.id())
        .send_notes_script(&send_script)
        .expected_output_note(RawOutputNote::Full(stranger_note.clone()))
        .build()?
        .execute()
        .await?;
    game.commit(&published)?;

    let owner_before = game.balance(game.owner.id());
    let stranger_before = game.balance(game.stranger.id());

    let attempted_theft = game.chain
        .build_transaction(game.owner.id())
        .authenticated_input_note(game.note.id())
        .authenticated_input_note(stranger_note.id())
        .build()?
        .execute()
        .await;

    assert!(attempted_theft.is_err(), "owner must not consume a note assigned to stranger");
    assert_eq!(game.balance(game.owner.id()), owner_before);
    assert_eq!(game.balance(game.stranger.id()), stranger_before);
    println!("PASS: cannot claim two notes with different authorized recipients");
    Ok(())
}
