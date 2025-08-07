use anchor_lang::prelude::*;
use crate::merkle_tree::NullifierSet;

#[derive(Accounts)]
pub struct InitializeNullifierSet<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    
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

pub fn process_initialize_nullifier_set(ctx: Context<InitializeNullifierSet>) -> Result<()> {
    let nullifier_set = &mut ctx.accounts.nullifier_set;
    nullifier_set.initialize(ctx.bumps.nullifier_set)?;
    
    msg!("Nullifier set initialized");
    Ok(())
}
