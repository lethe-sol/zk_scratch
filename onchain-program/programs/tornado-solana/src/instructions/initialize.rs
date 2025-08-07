use anchor_lang::prelude::*;
use crate::state::{TornadoPool, VerificationKeyAccount, Groth16VerifyingKey};
use crate::merkle_tree::{MerkleTree, NullifierSet};
use crate::errors::ErrorCode;

#[derive(Accounts)]
pub struct Initialize<'info> {
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
    
    #[account(
        init,
        payer = payer,
        space = 8 + MerkleTree::LEN,
        seeds = [b"merkle_tree"],
        bump
    )]
    pub merkle_tree: Account<'info, MerkleTree>,
    
    #[account(
        init,
        payer = payer,
        space = 8 + NullifierSet::LEN,
        seeds = [b"nullifier_set"],
        bump
    )]
    pub nullifier_set: Account<'info, NullifierSet>,
    
    pub system_program: Program<'info, System>,
}

pub fn process_initialize(
    ctx: Context<Initialize>,
    deposit_amount: u64,
    verification_key: Groth16VerifyingKey,
) -> Result<()> {
    let tornado_pool = &mut ctx.accounts.tornado_pool;
    let merkle_tree = &mut ctx.accounts.merkle_tree;
    let nullifier_set = &mut ctx.accounts.nullifier_set;
    
    require!(deposit_amount > 0, ErrorCode::InsufficientFunds);
    require!(verification_key.ic.len() == 8, ErrorCode::InvalidVerificationKey);
    
    tornado_pool.bump = ctx.bumps.tornado_pool;
    tornado_pool.deposit_amount = deposit_amount;
    tornado_pool.deposit_count = 0;
    let [verification_key_pda, _] = Pubkey::find_program_address(
        &[b"verification_key"],
        ctx.program_id,
    );
    tornado_pool.verification_key_account = verification_key_pda;
    
    merkle_tree.initialize(ctx.bumps.merkle_tree)?;
    nullifier_set.initialize(ctx.bumps.nullifier_set)?;
    
    msg!("Tornado pool initialized with deposit amount: {} lamports", deposit_amount);
    
    Ok(())
}
