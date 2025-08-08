use anchor_lang::prelude::*;
use anchor_lang::system_program;
use spl_account_compression::cpi::append;
use crate::{constants::*, errors::TornadoError, state::*};

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(
        mut,
        seeds = [STATE_SEED],
        bump = vault_state.bump
    )]
    pub vault_state: Account<'info, VaultState>,

    #[account(
        mut,
        seeds = [VAULT_SEED],
        bump
    )]
    pub vault: SystemAccount<'info>,

    /// CHECK: This is the merkle tree account used for SPL account compression.
    /// Validation is performed by the CPI call into the `spl-account-compression` program.
    #[account(mut)]
    pub merkle_tree: AccountInfo<'info>,

    /// CHECK: This is the tree authority PDA for the merkle tree.
    /// It is validated by the `spl-account-compression` program during the CPI.
    pub tree_authority: AccountInfo<'info>,

    #[account(mut)]
    pub depositor: Signer<'info>,

    /// CHECK: This is the SPL account compression program.
    /// The program ID is verified by Anchor when creating the CPI context.
    pub compression_program: AccountInfo<'info>,

    /// CHECK: This is the SPL Noop program used for logging in account compression.
    /// No data is read from this account; only the program ID is used.
    pub noop_program: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}
