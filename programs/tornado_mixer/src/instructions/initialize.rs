use anchor_lang::prelude::*;
use crate::{constants::*, errors::TornadoError, state::*};

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = VaultState::LEN,
        seeds = [STATE_SEED],
        bump
    )]
    pub vault_state: Account<'info, VaultState>,

    #[account(
        init,
        payer = authority,
        space = NullifierBitmap::LEN,
        seeds = [NULLIFIER_SEED],
        bump
    )]
    pub nullifier_bitmap: Account<'info, NullifierBitmap>,

    pub merkle_tree: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [VAULT_SEED],
        bump
    )]
    pub vault: SystemAccount<'info>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn initialize(ctx: Context<Initialize>, deposit_amount: u64) -> Result<()> {
    let vault_state = &mut ctx.accounts.vault_state;
    let nullifier_bitmap = &mut ctx.accounts.nullifier_bitmap;

    require!(
        deposit_amount == DEPOSIT_AMOUNT,
        TornadoError::InvalidDepositAmount
    );

    vault_state.merkle_tree = ctx.accounts.merkle_tree.key();
    vault_state.recent_roots = [None; MAX_RECENT_ROOTS];
    vault_state.recent_roots_index = 0;
    vault_state.deposit_amount = deposit_amount;
    vault_state.total_deposits = 0;
    vault_state.total_withdrawals = 0;
    vault_state.authority = ctx.accounts.authority.key();
    vault_state.bump = ctx.bumps.vault_state;

    nullifier_bitmap.bitmap = [0u64; 16384];
    nullifier_bitmap.bump = ctx.bumps.nullifier_bitmap;

    msg!("Tornado mixer initialized with deposit amount: {} lamports", deposit_amount);

    Ok(())
}
