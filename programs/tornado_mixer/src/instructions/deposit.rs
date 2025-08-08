use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::state::MixerConfig;

// SPL Account/State Compression + noop
use spl_account_compression::program::SplAccountCompression;
use spl_account_compression::cpi::{self, accounts::Modify, append};
use spl_noop::program::Noop;

#[derive(Accounts)]
pub struct Deposit<'info> {
    // Payer of lamports (funds go into the vault PDA)
    #[account(mut)]
    pub user: Signer<'info>,

    // Your config holding the Merkle tree pubkey
    pub config: Account<'info, MixerConfig>,

    /// CHECK: must equal config.merkle_tree; validated by address constraint
    #[account(mut, address = config.merkle_tree)]
    pub merkle_tree: UncheckedAccount<'info>,

    /// CHECK: vault is PDA [b"vault"]; acts as tree authority (no data read)
    #[account(mut, seeds = [b"vault"], bump)]
    pub vault: UncheckedAccount<'info>,

    // Programs needed for CPI
    pub compression_program: Program<'info, SplAccountCompression>,
    pub noop_program: Program<'info, Noop>,
    pub system_program: Program<'info, System>,
}

// Optional: make the deposit amount configurable via args if you want.
// For now, hard-code or read from config inside the handler.
pub fn deposit(ctx: Context<Deposit>, commitment: [u8; 32]) -> Result<()> {
    // ----- 1) Transfer lamports user -> vault (example: 0.1 SOL) -----
    // If you already transfer in the client, you can remove this block.
    // Change AMOUNT_LAMPORTS to what you want (or make it an arg).
    const AMOUNT_LAMPORTS: u64 = 100_000_000; // 0.1 SOL

    // CPI to SystemProgram::transfer
    let transfer_accounts = system_program::Transfer {
        from: ctx.accounts.user.to_account_info(),
        to:   ctx.accounts.vault.to_account_info(),
    };
    let transfer_ctx = CpiContext::new(ctx.accounts.system_program.to_account_info(), transfer_accounts);
    system_program::transfer(transfer_ctx, AMOUNT_LAMPORTS)?;

    // ----- 2) Append the commitment leaf to the Merkle tree -----
    // The tree's authority must be the `vault` PDA (set during initialize).
    // We sign with the vault PDA seeds so SPL AC accepts us as the authority.
    let cpi_program = ctx.accounts.compression_program.to_account_info();
    let accounts = Modify {
        merkle_tree: ctx.accounts.merkle_tree.to_account_info(),
        authority:   ctx.accounts.vault.to_account_info(),
        noop_program: ctx.accounts.noop_program.to_account_info(),
    };

    let vault_bump = *ctx.bumps.get("vault").expect("vault bump");
    let signer_seeds: &[&[u8]] = &[b"vault", &[vault_bump]];

    append(
        CpiContext::new_with_signer(cpi_program, accounts, &[signer_seeds]),
        commitment,
    )?;

    Ok(())
}
