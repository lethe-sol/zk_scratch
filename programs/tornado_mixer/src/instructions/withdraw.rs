use anchor_lang::prelude::*;
use crate::state::{MixerConfig, NullifierState};

#[derive(Accounts)]
#[instruction(nullifier_hash: [u8; 32])]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    pub config: Account<'info, MixerConfig>,

    /// CHECK: Must match config.merkle_tree (read only)
    #[account(
        address = config.merkle_tree
    )]
    pub merkle_tree: UncheckedAccount<'info>,

    /// Vault PDA (source of funds)
    #[account(
        mut,
        seeds = [b"vault"],
        bump
    )]
    pub vault: UncheckedAccount<'info>,

    /// Nullifier PDA — marks note as spent; init will fail if it already exists
    #[account(
        init,
        seeds = [b"nullifier", nullifier_hash.as_ref()],
        bump,
        payer = payer,
        space = 8 // discriminator only
    )]
    pub nullifier: Account<'info, NullifierState>,

    /// Recipient of the withdrawn SOL
    #[account(mut)]
    pub recipient: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}
