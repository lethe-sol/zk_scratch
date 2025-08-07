use anchor_lang::prelude::*;
use account_compression::{
    program::AccountCompression,
    RegisteredProgram,
};

use crate::state::TornadoPool;
use crate::errors::ErrorCode;

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub depositor: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"tornado_pool"],
        bump = tornado_pool.bump,
    )]
    pub tornado_pool: Account<'info, TornadoPool>,
    
    pub authority: Signer<'info>,
    pub registered_program_pda: Option<Account<'info, RegisteredProgram>>,
    pub log_wrapper: UncheckedAccount<'info>,
    #[account(mut)]
    pub merkle_tree: AccountInfo<'info>,
    
    pub account_compression_program: Program<'info, AccountCompression>,
    pub system_program: Program<'info, System>,
}

pub fn process_deposit(
    ctx: Context<Deposit>,
    commitment: [u8; 32],
) -> Result<()> {
    let tornado_pool = &mut ctx.accounts.tornado_pool;
    
    let transfer_ix = anchor_lang::system_program::Transfer {
        from: ctx.accounts.depositor.to_account_info(),
        to: tornado_pool.to_account_info(),
    };
    anchor_lang::system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            transfer_ix,
        ),
        tornado_pool.deposit_amount,
    )?;
    
    let insert_data = serialize_commitment_for_insertion(commitment)?;
    
    let cpi_accounts = account_compression::cpi::accounts::GenericInstruction {
        authority: ctx.accounts.authority.to_account_info(),
        registered_program_pda: ctx.accounts.registered_program_pda.as_ref().map(|a| a.to_account_info()),
        log_wrapper: ctx.accounts.log_wrapper.to_account_info(),
        merkle_tree: ctx.accounts.merkle_tree.to_account_info(),
    };
    
    let cpi_ctx = CpiContext::new(
        ctx.accounts.account_compression_program.to_account_info(),
        cpi_accounts,
    );
    
    account_compression::cpi::insert_into_queues(cpi_ctx, insert_data)
        .map_err(|_| ErrorCode::LightProtocolError)?;
    
    tornado_pool.deposit_count += 1;
    
    emit!(DepositEvent {
        commitment,
        leaf_index: tornado_pool.deposit_count - 1,
        timestamp: Clock::get()?.unix_timestamp,
    });
    
    msg!("Deposit successful: commitment={:?}, leaf_index={}", commitment, tornado_pool.deposit_count - 1);
    
    Ok(())
}

fn serialize_commitment_for_insertion(commitment: [u8; 32]) -> Result<Vec<u8>> {
    let mut data = Vec::new();
    data.extend_from_slice(&commitment);
    Ok(data)
}

#[event]
pub struct DepositEvent {
    pub commitment: [u8; 32],
    pub leaf_index: u64,
    pub timestamp: i64,
}
