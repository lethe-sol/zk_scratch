use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::state::MixerConfig;

// SPL State/Account Compression + noop (log wrapper)
use spl_account_compression::program::SplAccountCompression;
use spl_account_compression::cpi::{accounts::Modify, append};
use spl_noop::noop;
#[derive(Accounts)]
pub struct Deposit<'info> {
    /// Payer; funds move from here into the vault PDA
    #[account(mut)]
    pub user: Signer<'info>,

    /// Mixer config that stores the Merkle tree pubkey
    pub config: Account<'info, MixerConfig>,

    /// CHECK: must equal config.merkle_tree; header validity checked in handler
    #[account(mut, address = config.merkle_tree)]
    pub merkle_tree: UncheckedAccount<'info>,

    /// CHECK: vault PDA authority for the tree; no data is read, only lamports/signing
    #[account(mut, seeds = [b"vault"], bump)]
    pub vault: UncheckedAccount<'info>,

    /// SPL Account/State Compression program (fixed ID on cluster)
    pub compression_program: Program<'info, SplAccountCompression>,

    /// Noop program (log wrapper for changelog)
    pub noop_program: Program<'info, Noop>,

    pub system_program: Program<'info, System>,
}

pub fn deposit(ctx: Context<Deposit>, commitment: [u8; 32]) -> Result<()> {
    // --------------------------
    // 1) Transfer lamports -> vault
    // --------------------------
    // If your client is also doing a transfer, remove this block to avoid double-paying.
    const AMOUNT_LAMPORTS: u64 = 100_000_000; // 0.1 SOL

    let transfer_accounts = system_program::Transfer {
        from: ctx.accounts.user.to_account_info(),
        to:   ctx.accounts.vault.to_account_info(),
    };
    let transfer_ctx = CpiContext::new(ctx.accounts.system_program.to_account_info(), transfer_accounts);
    system_program::transfer(transfer_ctx, AMOUNT_LAMPORTS)?;

    // --------------------------
    // 2) Append commitment as leaf to Merkle tree
    // --------------------------
    // IMPORTANT: the tree's authority must be the `vault` PDA (set during initialize or via transferAuthority).
    let accounts = Modify {
        merkle_tree: ctx.accounts.merkle_tree.to_account_info(),
        authority:   ctx.accounts.vault.to_account_info(),
        // NOTE: in Modify the field name is `noop` (not `noop_program`)
        noop:        ctx.accounts.noop_program.to_account_info(),
    };

    // Anchor 0.31: bumps are fields
    let vault_bump = ctx.bumps.vault;
    let signer_seeds: &[&[u8]] = &[b"vault", &[vault_bump]];

    append(
        CpiContext::new_with_signer(
            ctx.accounts.compression_program.to_account_info(),
            accounts,
            &[signer_seeds],
        ),
        commitment,
    )?;

    Ok(())
}
