use anchor_lang::prelude::*;
use crate::state::MixerConfig;

#[derive(Accounts)]
pub struct Deposit<'info> {
    // User making the deposit (will sign and pay the 0.1 SOL)
    #[account(mut)]
    pub user: Signer<'info>,
    // Mixer config to verify the correct merkle tree
    pub config: Account<'info, MixerConfig>,
    /// CHECK: Merkle tree account (must match config.merkle_tree)
    #[account(
        mut,
        address = config.merkle_tree   // ensure we're using the correct tree
    )]
    pub merkle_tree: UncheckedAccount<'info>,
    /// CHECK: Vault PDA (pool account) - derived by seed
    #[account(
        mut,
        seeds = [b"vault"],
        bump
    )]
    pub vault: UncheckedAccount<'info>,
    /// CHECK: Compression program (for CPI)
    #[account(address = ACCOUNT_COMPRESSION_ID)]
    pub compression_program: UncheckedAccount<'info>,
    /// CHECK: Noop program (for CPI)
    #[account(address = NOOP_PROGRAM_ID)]
    pub noop_program: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}
