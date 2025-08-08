use anchor_lang::prelude::*;
use crate::state::{MixerConfig, NullifierState};

#[derive(Accounts)]
#[instruction(nullifier_hash: [u8; 32])]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    pub config: Account<'info, MixerConfig>,

    /// CHECK: Must equal config.merkle_tree; read-only here (no mutation).
    /// We validate proof against a root and rely on nullifier PDA for uniqueness.
    #[account(
        address = config.merkle_tree
    )]
    pub merkle_tree: UncheckedAccount<'info>,

    /// CHECK: Vault is PDA [b"vault"]; used only for lamports and as signer via seeds.
    #[account(
        mut,
        seeds = [b"vault"],
        bump
    )]
    pub vault: UncheckedAccount<'info>,

    #[account(
        init,
        seeds = [b"nullifier", nullifier_hash.as_ref()],
        bump,
        payer = payer,
        space = 8 // discriminator only
    )]
    pub nullifier: Account<'info, NullifierState>,

    #[account(mut)]
    pub recipient: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}
