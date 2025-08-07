use anchor_lang::prelude::*;
use crate::state::{VerificationKeyAccount, Groth16VerifyingKey};
use crate::errors::ErrorCode;

#[derive(Accounts)]
pub struct InitializeVerificationKey<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    
    #[account(
        init,
        payer = payer,
        space = 8 + VerificationKeyAccount::LEN,
        seeds = [b"verification_key"],
        bump
    )]
    pub verification_key_account: Account<'info, VerificationKeyAccount>,
    
    pub system_program: Program<'info, System>,
}

pub fn process_initialize_verification_key(
    ctx: Context<InitializeVerificationKey>,
    verification_key: Groth16VerifyingKey,
) -> Result<()> {
    require!(verification_key.ic.len() == 8, ErrorCode::InvalidVerificationKey);
    
    let vk_account = &mut ctx.accounts.verification_key_account;
    vk_account.bump = ctx.bumps.verification_key_account;
    vk_account.verification_key = verification_key;
    
    msg!("Verification key account initialized");
    Ok(())
}
