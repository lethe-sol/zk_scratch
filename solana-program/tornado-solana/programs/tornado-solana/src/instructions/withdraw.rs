use anchor_lang::prelude::*;
use groth16_solana::{
    groth16::{Groth16Verifier, ProofPoints, Groth16Verifyingkey},
};
use crate::state::*;
use crate::errors::*;
use crate::events::*;
use crate::verifying_key::VERIFYINGKEY;

#[derive(Accounts)]
#[instruction(nullifier_hash: [u8; 32])]
pub struct Withdraw<'info> {
    #[account(
        mut,
        seeds = [b"tornado_state"],
        bump
    )]
    pub state: Account<'info, TornadoState>,
    
    #[account(mut)]
    pub recipient: AccountInfo<'info>,
    
    #[account(
        address = state.merkle_tree
    )]
    pub merkle_tree: AccountInfo<'info>,
    
    #[account(
        init_if_needed,
        payer = recipient,
        space = NullifierMarker::LEN,
        seeds = [b"nullifier", nullifier_hash.as_ref()],
        bump
    )]
    pub nullifier_marker: Account<'info, NullifierMarker>,
    
    pub system_program: Program<'info, System>,
    
    pub groth16_verifier: AccountInfo<'info>,
}

pub fn handler(
    ctx: Context<Withdraw>,
    proof_a: [u8; 64],
    proof_b: [u8; 128],
    proof_c: [u8; 64],
    public_inputs: [[u8; 32]; 7],
    nullifier_hash: [u8; 32],
) -> Result<()> {
    let state = &mut ctx.accounts.state;
    
    require!(
        ctx.accounts.nullifier_marker.nullifier_hash == [0u8; 32],
        TornadoError::NullifierAlreadySpent
    );
    
    ctx.accounts.nullifier_marker.nullifier_hash = nullifier_hash;
    
    let recipient_pubkey = reconstruct_pubkey(public_inputs[2], public_inputs[3])?;
    
    require!(
        recipient_pubkey == ctx.accounts.recipient.key(),
        TornadoError::InvalidPublicInputs
    );
    
    let fee = u64::from_le_bytes(
        public_inputs[6][0..8].try_into()
            .map_err(|_| TornadoError::InvalidPublicInputs)?
    );
    
    verify_groth16_proof(
        &ctx.accounts.groth16_verifier,
        &proof_a,
        &proof_b,
        &proof_c,
        &public_inputs,
        state.verifying_key_initialized,
    )?;
    
    let deposit_amount = 100_000_000u64;
    require!(fee <= deposit_amount, TornadoError::InvalidPublicInputs);
    let withdraw_amount = deposit_amount - fee;
    
    **state.to_account_info().try_borrow_mut_lamports()? -= withdraw_amount;
    **ctx.accounts.recipient.try_borrow_mut_lamports()? += withdraw_amount;
    
    emit!(WithdrawEvent {
        nullifier_hash,
        recipient: recipient_pubkey,
        fee,
        timestamp: Clock::get()?.unix_timestamp,
    });
    
    msg!("Withdrawal successful: recipient {:?}, fee: {}", recipient_pubkey, fee);
    
    Ok(())
}

fn reconstruct_pubkey(part1: [u8; 32], part2: [u8; 32]) -> Result<Pubkey> {
    Ok(Pubkey::new_from_array(part1))
}

fn verify_groth16_proof(
    _verifier_program: &AccountInfo,
    proof_a: &[u8; 64],
    proof_b: &[u8; 128],
    proof_c: &[u8; 64],
    public_inputs: &[[u8; 32]; 7],
    verifying_key_initialized: bool,
) -> Result<()> {
    require!(verifying_key_initialized, TornadoError::InvalidProof);
    require!(*proof_a != [0u8; 64], TornadoError::InvalidProof);
    require!(*proof_b != [0u8; 128], TornadoError::InvalidProof);
    require!(*proof_c != [0u8; 64], TornadoError::InvalidProof);
    
    let proof_points = ProofPoints {
        a: *proof_a,
        b: *proof_b,
        c: *proof_c,
    };
    
    let mut inputs = [0u64; 8];
    for (i, input) in public_inputs.iter().enumerate() {
        inputs[i] = u64::from_le_bytes(
            input[0..8].try_into()
                .map_err(|_| TornadoError::InvalidPublicInputs)?
        );
    }
    
    let verifier = Groth16Verifier::new(&proof_points, &inputs, &VERIFYINGKEY)
        .map_err(|_| TornadoError::InvalidProof)?;
    
    let is_valid = verifier.verify()
        .map_err(|_| TornadoError::InvalidProof)?;
    
    require!(is_valid, TornadoError::InvalidProof);
    
    msg!("Groth16 proof verification successful using Light Protocol");
    
    Ok(())
}
