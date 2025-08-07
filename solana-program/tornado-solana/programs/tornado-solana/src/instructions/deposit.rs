use anchor_lang::prelude::*;
use anchor_lang::system_program;
use spl_account_compression::{
    program::SplAccountCompression,
    cpi::{accounts::Modify, append},
    Noop,
};
use crate::state::*;
use crate::errors::*;
use crate::events::*;

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(
        mut,
        seeds = [b"tornado_state"],
        bump
    )]
    pub state: Account<'info, TornadoState>,
    
    #[account(mut)]
    pub depositor: Signer<'info>,
    
    #[account(
        mut,
        address = state.merkle_tree
    )]
    pub merkle_tree: AccountInfo<'info>,
    
    pub system_program: Program<'info, System>,
    pub compression_program: Program<'info, SplAccountCompression>,
    pub log_wrapper: Program<'info, Noop>,
}

pub fn handler(ctx: Context<Deposit>, commitment: [u8; 32]) -> Result<()> {
    let state = &mut ctx.accounts.state;
    
    let deposit_amount = 100_000_000u64;
    
    require!(
        ctx.accounts.depositor.lamports() >= deposit_amount,
        TornadoError::InsufficientFunds
    );
    
    require!(
        commitment != [0u8; 32],
        TornadoError::InvalidCommitment
    );
    
    let transfer_instruction = system_program::transfer(
        &ctx.accounts.depositor.key(),
        &state.key(),
        deposit_amount,
    );
    
    anchor_lang::solana_program::program::invoke(
        &transfer_instruction,
        &[
            ctx.accounts.depositor.to_account_info(),
            state.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
        ],
    )?;
    
    let seeds = &[b"tornado_state", &[ctx.bumps.state]];
    let signer = &[&seeds[..]];
    
    let cpi_accounts = Modify {
        merkle_tree: ctx.accounts.merkle_tree.to_account_info(),
        authority: state.to_account_info(),
        noop: ctx.accounts.log_wrapper.to_account_info(),
    };
    
    let cpi_program = ctx.accounts.compression_program.to_account_info();
    let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
    
    append(cpi_ctx, commitment.to_vec())?;
    
    let leaf_index = state.deposit_count;
    state.deposit_count += 1;
    
    emit!(DepositEvent {
        commitment,
        leaf_index,
        timestamp: Clock::get()?.unix_timestamp,
    });
    
    msg!("Deposit successful: commitment {:?}, leaf_index: {}", commitment, leaf_index);
    
    Ok(())
}
