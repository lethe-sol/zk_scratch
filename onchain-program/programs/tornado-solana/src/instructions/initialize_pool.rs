use anchor_lang::prelude::*;
use crate::state::TornadoPool;
use crate::errors::ErrorCode;

#[derive(Accounts)]
pub struct InitializePool<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    
    #[account(
        init,
        payer = payer,
        space = 8 + TornadoPool::LEN,
        seeds = [b"tornado_pool"],
        bump
    )]
    pub tornado_pool: Account<'info, TornadoPool>,
    
    pub system_program: Program<'info, System>,
}

pub fn process_initialize_pool(
    ctx: Context<InitializePool>,
    deposit_amount: u64,
    verification_key_account: Pubkey,
) -> Result<()> {
    require!(deposit_amount > 0, ErrorCode::InsufficientFunds);
    
    let tornado_pool = &mut ctx.accounts.tornado_pool;
    tornado_pool.bump = ctx.bumps.tornado_pool;
    tornado_pool.deposit_amount = deposit_amount;
    tornado_pool.deposit_count = 0;
    tornado_pool.verification_key_account = verification_key_account;
    
    msg!("Tornado pool initialized with deposit amount: {} lamports", deposit_amount);
    Ok(())
}
