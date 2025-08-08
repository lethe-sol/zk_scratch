// programs/tornado_mixer/src/instructions/withdraw.rs
use anchor_lang::prelude::*;
use crate::state::{MixerConfig, NullifierState};

/// Accounts for `withdraw`.
///
/// Notes:
/// - `merkle_tree` must equal the SPL CMT tree stored in `config`.
/// - `vault` is the PDA authority (seed = "vault") that holds funds and signs via seeds.
/// - `nullifier` PDA (seed = ["nullifier", nullifier_hash]) is *initialized* here to
///   enforce one-time spend on-chain. A second withdrawal with the same nullifier_hash
///   will fail at account-creation time.
/// - `recipient` receives the lamports after proof verification in the handler.
#[derive(Accounts)]
#[instruction(nullifier_hash: [u8; 32])]
pub struct Withdraw<'info> {
    /// Payer for the nullifier PDA rent; also tx signer.
    #[account(mut)]
    pub payer: Signer<'info>,

    /// Mixer configuration (stores the Merkle tree pubkey, and later a roots window).
    pub config: Account<'info, MixerConfig>,

    /// CHECK: Must equal `config.merkle_tree` (validated by constraint).
    #[account(
        address = config.merkle_tree
    )]
    pub merkle_tree: UncheckedAccount<'info>,

    /// CHECK: Vault PDA authority for the tree & funds.
    /// PDA = Pubkey::find_program_address([b"vault"], program_id)
    #[account(
        mut,
        seeds = [b"vault"],
        bump
    )]
    pub vault: UncheckedAccount<'info>,

    /// Nullifier PDA — initialized to mark the note as spent.
    /// PDA = Pubkey::find_program_address([b"nullifier", nullifier_hash.as_ref()], program_id)
    #[account(
        init,
        seeds = [b"nullifier", nullifier_hash.as_ref()],
        bump,
        payer = payer,
        space = 8 // discriminator only; no extra data needed
    )]
    pub nullifier: Account<'info, NullifierState>,

    /// Recipient of the withdrawal (system account for lamport transfer).
    #[account(mut)]
    pub recipient: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}
