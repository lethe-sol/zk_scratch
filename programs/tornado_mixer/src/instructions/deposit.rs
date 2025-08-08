use anchor_lang::prelude::*;
use crate::state::MixerConfig;

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    pub config: Account<'info, MixerConfig>,

    /// CHECK: Must be the same tree recorded in config
    #[account(
        mut,
        address = config.merkle_tree
    )]
    pub merkle_tree: UncheckedAccount<'info>,

    /// Vault PDA (pool)
    #[account(
        mut,
        seeds = [b"vault"],
        bump
    )]
    pub vault: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}
