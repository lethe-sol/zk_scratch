use anchor_lang::prelude::*;
use groth16_solana::groth16::Groth16Verifier;
use crate::{constants::*, errors::TornadoError, state::*};

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(
        mut,
        seeds = [STATE_SEED],
        bump = vault_state.bump
    )]
    pub vault_state: Account<'info, VaultState>,

    #[account(
        mut,
        seeds = [NULLIFIER_SEED],
        bump = nullifier_bitmap.bump
    )]
    pub nullifier_bitmap: Account<'info, NullifierBitmap>,

    #[account(
        mut,
        seeds = [VAULT_SEED],
        bump
    )]
    pub vault: SystemAccount<'info>,

    #[account(mut)]
    pub recipient: UncheckedAccount<'info>,

    #[account(mut)]
    pub withdrawer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn withdraw(
    ctx: Context<Withdraw>,
    proof: [u8; 256],
    root: [u8; 32],
    nullifier_hash: [u8; 32],
    recipient: Pubkey,
) -> Result<()> {
    let vault_state = &mut ctx.accounts.vault_state;
    let nullifier_bitmap = &mut ctx.accounts.nullifier_bitmap;

    require!(
        !nullifier_bitmap.is_nullifier_spent(&nullifier_hash),
        TornadoError::NullifierAlreadySpent
    );

    require!(
        vault_state.is_valid_root(&root),
        TornadoError::InvalidMerkleRoot
    );

    let public_inputs = prepare_public_inputs(&root, &nullifier_hash, &recipient)?;
    
    let proof_a: [u8; 64] = proof[0..64].try_into().unwrap();
    let proof_b: [u8; 128] = proof[64..192].try_into().unwrap(); 
    let proof_c: [u8; 64] = proof[192..256].try_into().unwrap();
    
    let verifying_key = get_verifying_key()?;
    let mut verifier = Groth16Verifier::new(
        &proof_a,
        &proof_b, 
        &proof_c,
        &public_inputs,
        &verifying_key,
    ).map_err(|_| TornadoError::InvalidProof)?;
    
    require!(
        verifier.verify().is_ok(),
        TornadoError::InvalidProof
    );

    nullifier_bitmap.mark_nullifier_spent(&nullifier_hash)?;

    let vault_balance = ctx.accounts.vault.lamports();
    let withdraw_amount = vault_state.deposit_amount;
    
    require!(
        vault_balance >= withdraw_amount,
        TornadoError::InsufficientVaultBalance
    );

    let vault_seeds = &[VAULT_SEED, &[ctx.bumps.vault]];
    let _signer_seeds = &[&vault_seeds[..]];

    **ctx.accounts.vault.try_borrow_mut_lamports()? -= withdraw_amount;
    **ctx.accounts.recipient.try_borrow_mut_lamports()? += withdraw_amount;

    vault_state.total_withdrawals = vault_state
        .total_withdrawals
        .checked_add(1)
        .ok_or(TornadoError::ArithmeticOverflow)?;

    msg!(
        "Withdrawal successful: nullifier_hash={:?}, recipient={}, amount={}",
        nullifier_hash,
        recipient,
        withdraw_amount
    );

    Ok(())
}

fn prepare_public_inputs(
    root: &[u8; 32],
    nullifier_hash: &[u8; 32],
    recipient: &Pubkey,
) -> Result<[[u8; 32]; 7]> {
    let mut public_inputs = [[0u8; 32]; 7];
    
    public_inputs[0] = *root;
    public_inputs[1] = *nullifier_hash;
    
    let recipient_bytes = recipient.to_bytes();
    public_inputs[2][0..16].copy_from_slice(&recipient_bytes[0..16]);
    public_inputs[3][0..16].copy_from_slice(&recipient_bytes[16..32]);
    
    Ok(public_inputs)
}

fn get_verifying_key() -> Result<groth16_solana::groth16::Groth16Verifyingkey<'static>> {
    
    
    Err(TornadoError::InvalidProof.into())
}
