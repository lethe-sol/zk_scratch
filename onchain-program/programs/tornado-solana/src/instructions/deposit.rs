use anchor_lang::prelude::*;
use crate::state::TornadoPool;
use crate::merkle_tree::MerkleTree;
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
    
    #[account(
        mut,
        seeds = [b"merkle_tree"],
        bump = merkle_tree.bump,
    )]
    pub merkle_tree: Account<'info, MerkleTree>,
    
    pub system_program: Program<'info, System>,
}

pub fn process_deposit(
    ctx: Context<Deposit>,
    commitment: [u8; 32],
) -> Result<()> {
    let tornado_pool = &mut ctx.accounts.tornado_pool;
    let merkle_tree = &mut ctx.accounts.merkle_tree;
    
    let transfer_ix = anchor_lang::system_program::Transfer {
        from: ctx.accounts.depositor.to_account_info(),
        to: tornado_pool.to_account_info(),
    };
    
    anchor_lang::system_program::transfer(
        CpiContext::new(ctx.accounts.system_program.to_account_info(), transfer_ix),
        tornado_pool.deposit_amount,
    )?;
    
    let leaf_index = merkle_tree.insert(commitment)?;
    tornado_pool.deposit_count += 1;
    
    emit!(DepositEvent {
        commitment,
        leaf_index,
        timestamp: Clock::get()?.unix_timestamp,
    });
    
    msg!("Deposit successful. Commitment: {:?}, Leaf index: {}", commitment, leaf_index);
    
    Ok(())
}

#[event]
pub struct DepositEvent {
    pub commitment: [u8; 32],
    pub leaf_index: u32,
    pub timestamp: i64,
}
