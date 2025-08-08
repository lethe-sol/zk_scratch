// programs/tornado_mixer/src/instructions/initialize.rs
use anchor_lang::prelude::*;
use crate::state::MixerConfig;
use spl_account_compression::ID as CMT_ID;

#[derive(Accounts)]
pub struct Initialize<'info> {
    /// Pays rent/fees.
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: PDA signer for the Merkle tree authority; holds lamports and signs via seeds [b"vault"].

    /// (Lamport bucket / signer via seeds; no data needed.)
    #[account(
        init,
        seeds = [b"vault"],
        bump,
        payer = payer,
        space = 8 // discriminator only
    )]
    pub vault: UncheckedAccount<'info>,

   .
    /// CHECK: REAL SPL CMT account (owned by cmtDvXum…); validated in handler.
    /// REAL Concurrent Merkle Tree account (owned by SPL Account Compression).
    /// We mark it mut because we'll append leaves later
    #[account(mut)]
    pub merkle_tree: UncheckedAccount<'info>,

    /// Stores the chosen Merkle tree pubkey for later use.
    #[account(
        init,
        seeds = [b"config"],
        bump,
        payer = payer,
        space = 8 + 32 // discriminator + Pubkey
    )]
    pub config: Account<'info, MixerConfig>,

    pub system_program: Program<'info, System>,
}

pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
    // Ensure this is an actual SPL CMT account (not our own PDA).
    // AccountInfo.owner is &Pubkey, so deref it for comparison.
    require_keys_eq!(
        *ctx.accounts.merkle_tree.owner,
        CMT_ID,
    );

    // Persist the tree so deposit() can enforce it later.
    ctx.accounts.config.merkle_tree = ctx.accounts.merkle_tree.key();

    // Optional: log for sanity
    msg!("Initialized with Merkle tree = {}", ctx.accounts.merkle_tree.key());
    Ok(())
}
