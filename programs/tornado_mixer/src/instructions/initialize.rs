use anchor_lang::prelude::*;
use crate::state::MixerConfig;
use spl_account_compression::ID as CMT_ID;

#[derive(Accounts)]
pub struct Initialize<'info> {
    /// Pays rent/fees.
    #[account(mut)]
    pub payer: Signer<'info>,

    /// PDA that will act as the Merkle tree authority for deposits.
    /// (Just a lamport bucket / signer via seeds; no data needed.)
    #[account(
        init,
        seeds = [b"vault"],
        bump,
        payer = payer,
        space = 8 // discriminator only
    )]
    pub vault: UncheckedAccount<'info>,

    /// The REAL Concurrent Merkle Tree account you created off-chain.
    /// Must be owned by the SPL Account Compression program (cmtDvXum…).
    /// We mark it mut because you'll append leaves later.
    /// CHECK: ownership verified in handler.
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
    // Ensure we're pointing at an actual SPL CMT account, not your program’s PDA.
    require_keys_eq!(
        ctx.accounts.merkle_tree.owner,
        CMT_ID,
        crate::errors::TornadoError::InvalidOwner
    );

    // (Optional but recommended) Sanity log:
    msg!("Initialized with Merkle tree = {}", ctx.accounts.merkle_tree.key());

    // Persist the tree so deposit() can require it later.
    ctx.accounts.config.merkle_tree = ctx.accounts.merkle_tree.key();
    Ok(())
}
