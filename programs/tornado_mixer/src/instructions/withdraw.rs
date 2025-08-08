use anchor_lang::prelude::*;
use crate::state::{MixerConfig, NullifierState};

#[derive(Accounts)]
pub struct Withdraw<'info> {
    // The signer paying for this transaction (could be the recipient or a relayer; must sign to cover fees)
    #[account(mut)]
    pub payer: Signer<'info>,
    pub config: Account<'info, MixerConfig>,
    /// CHECK: Merkle tree account (must match config)
    #[account(
        address = config.merkle_tree
    )]
    pub merkle_tree: UncheckedAccount<'info>,
    /// CHECK: Vault PDA (pool account) holding funds
    #[account(
        mut,
        seeds = [b"vault"],
        bump
    )]
    pub vault: UncheckedAccount<'info>,
    // Nullifier PDA: will be created to mark this nullifier as spent
    #[account(
        init,
        seeds = [b"nullifier", nullifier_hash.as_ref()], 
        bump,
        payer = payer,
        space = 8,       // only needs 8 bytes for discriminator (no fields)
        owner = program_id
    )]
    pub nullifier: Account<'info, NullifierState>,
    /// Recipient of the withdrawn funds
    #[account(mut)]
    pub recipient: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
}
