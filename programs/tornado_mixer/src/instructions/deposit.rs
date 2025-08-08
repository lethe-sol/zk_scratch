use anchor_lang::prelude::*;
use crate::state::MixerConfig;

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    pub config: Account<'info, MixerConfig>,

    /// CHECK: Must equal config.merkle_tree; header validity is asserted in the handler
    /// before modifying tree bytes. We only use it to read header and append a leaf.
    #[account(
        mut,
        address = config.merkle_tree
    )]
    pub merkle_tree: UncheckedAccount<'info>,

    /// CHECK: Vault is the PDA [b"vault"]; we don't access any account data, only lamports.
    /// It also serves as authority for the tree and signs via seeds in handlers.
    #[account(
        mut,
        seeds = [b"vault"],
        bump
    )]
    pub vault: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}
