use anchor_lang::prelude::*;
use crate::state::{TornadoPool, Groth16VerifyingKey};
use crate::errors::ErrorCode;

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(
        init,
        payer = authority,
        space = 8 + TornadoPool::LEN,
        seeds = [b"tornado_pool"],
        bump
    )]
    pub tornado_pool: Account<'info, TornadoPool>,
    
    /// CHECK: Merkle tree account for Light Protocol compression
    pub merkle_tree: UncheckedAccount<'info>,
    /// CHECK: Nullifier queue account for Light Protocol compression
    pub nullifier_queue: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

pub fn process_initialize(
    ctx: Context<Initialize>,
    deposit_amount: u64,
    verification_key: Groth16VerifyingKey,
) -> Result<()> {
    let tornado_pool = &mut ctx.accounts.tornado_pool;
    
    require!(deposit_amount > 0, ErrorCode::InvalidDepositAmount);
    require!(verification_key.ic.len() == 8, ErrorCode::InvalidVerificationKey);
    
    tornado_pool.authority = ctx.accounts.authority.key();
    tornado_pool.deposit_amount = deposit_amount;
    tornado_pool.deposit_count = 0;
    tornado_pool.verification_key = verification_key;
    tornado_pool.merkle_tree = ctx.accounts.merkle_tree.key();
    tornado_pool.nullifier_queue = ctx.accounts.nullifier_queue.key();
    tornado_pool.bump = ctx.bumps.tornado_pool;
    
    msg!("Tornado pool initialized with deposit amount: {} lamports", deposit_amount);
    
    Ok(())
}
