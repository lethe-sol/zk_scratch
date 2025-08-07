use anchor_lang::prelude::*;
use crate::merkle_tree::MerkleTree;

#[derive(Accounts)]
pub struct InitializeMerkleTree<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    
    #[account(
        init,
        payer = payer,
        space = 8 + MerkleTree::LEN,
        seeds = [b"merkle_tree"],
        bump
    )]
    pub merkle_tree: Account<'info, MerkleTree>,
    
    pub system_program: Program<'info, System>,
}

pub fn process_initialize_merkle_tree(ctx: Context<InitializeMerkleTree>) -> Result<()> {
    let merkle_tree = &mut ctx.accounts.merkle_tree;
    merkle_tree.initialize(ctx.bumps.merkle_tree)?;
    
    msg!("Merkle tree initialized");
    Ok(())
}
