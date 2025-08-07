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

    #[account(mut)]
    pub merkle_tree: AccountInfo<'info>,

    pub tree_authority: AccountInfo<'info>,

    #[account(mut)]
    pub depositor: Signer<'info>,

    pub compression_program: AccountInfo<'info>,

    pub noop_program: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

pub fn deposit(ctx: Context<Deposit>, commitment: [u8; 32]) -> Result<()> {
    let vault_state = &mut ctx.accounts.vault_state;

    let deposit_amount = vault_state.deposit_amount;
    
    let transfer_instruction = system_program::Transfer {
        from: ctx.accounts.depositor.to_account_info(),
        to: ctx.accounts.vault.to_account_info(),
    };
    
    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            transfer_instruction,
        ),
        deposit_amount,
    )?;


    let cpi_accounts = spl_account_compression::cpi::accounts::Modify {
        merkle_tree: ctx.accounts.merkle_tree.to_account_info(),
        authority: ctx.accounts.tree_authority.to_account_info(),
        noop: ctx.accounts.noop_program.to_account_info(),
    };

    let cpi_ctx = CpiContext::new(
        ctx.accounts.compression_program.to_account_info(),
        cpi_accounts,
    );

    append(cpi_ctx, commitment).map_err(|e| {
        msg!("Failed to append to merkle tree: {:?}", e);
        TornadoError::InvalidProof
    })?;

    vault_state.total_deposits = vault_state
        .total_deposits
        .checked_add(1)
        .ok_or(TornadoError::ArithmeticOverflow)?;

    msg!(
        "Deposit successful: commitment={:?}, total_deposits={}",
        commitment,
        vault_state.total_deposits
    );

    Ok(())
}
