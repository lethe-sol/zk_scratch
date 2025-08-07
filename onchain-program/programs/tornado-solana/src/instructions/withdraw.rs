use anchor_lang::prelude::*;
use groth16_solana::groth16::{Groth16Verifier, Groth16Verifyingkey};
use crate::state::{TornadoPool, VerificationKeyAccount};
use crate::merkle_tree::{MerkleTree, NullifierSet};
use crate::errors::ErrorCode;

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub withdrawer: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"tornado_pool"],
        bump = tornado_pool.bump,
    )]
    pub tornado_pool: Account<'info, TornadoPool>,
    
    #[account(
        seeds = [b"verification_key"],
        bump = verification_key_account.bump,
    )]
    pub verification_key_account: Account<'info, VerificationKeyAccount>,
    
    #[account(
        seeds = [b"merkle_tree"],
        bump = merkle_tree.bump,
    )]
    pub merkle_tree: Account<'info, MerkleTree>,
    
    #[account(
        mut,
        seeds = [b"nullifier_set"],
        bump = nullifier_set.bump,
    )]
    pub nullifier_set: Account<'info, NullifierSet>,
    
    /// CHECK: Recipient account for withdrawal funds
    #[account(mut)]
    pub recipient: UncheckedAccount<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct WithdrawPublicInputs {
    pub root: [u8; 32],
    pub nullifier_hash: [u8; 32],
    pub recipient_1: [u8; 32],
    pub recipient_2: [u8; 32],
    pub relayer_1: [u8; 32],
    pub relayer_2: [u8; 32],
    pub fee: [u8; 32],
}

pub fn process_withdraw(
    ctx: Context<Withdraw>,
    proof_a: [u8; 64],
    proof_b: [u8; 128],
    proof_c: [u8; 64],
    public_inputs: WithdrawPublicInputs,
    merkle_proof: Vec<[u8; 32]>,
    path_indices: Vec<bool>,
) -> Result<()> {
    let tornado_pool = &mut ctx.accounts.tornado_pool;
    let merkle_tree = &ctx.accounts.merkle_tree;
    let nullifier_set = &mut ctx.accounts.nullifier_set;
    
    verify_groth16_proof(
        &proof_a,
        &proof_b,
        &proof_c,
        &public_inputs,
        &ctx.accounts.verification_key_account.verification_key,
    )?;
    
    require!(merkle_tree.is_valid_root(public_inputs.root), ErrorCode::InvalidMerkleProof);
    
    
    nullifier_set.add_nullifier(public_inputs.nullifier_hash)?;
    
    let recipient_pubkey = reconstruct_solana_pubkey(
        public_inputs.recipient_1,
        public_inputs.recipient_2,
    )?;
    
    require_keys_eq!(
        recipient_pubkey,
        ctx.accounts.recipient.key(),
        ErrorCode::InvalidRecipient
    );
    
    **tornado_pool.to_account_info().try_borrow_mut_lamports()? -= tornado_pool.deposit_amount;
    **ctx.accounts.recipient.to_account_info().try_borrow_mut_lamports()? += tornado_pool.deposit_amount;
    
    emit!(WithdrawEvent {
        nullifier_hash: public_inputs.nullifier_hash,
        recipient: recipient_pubkey,
        timestamp: Clock::get()?.unix_timestamp,
    });
    
    msg!("Withdrawal successful: nullifier_hash={:?}, recipient={}", public_inputs.nullifier_hash, recipient_pubkey);
    
    Ok(())
}

fn verify_groth16_proof(
    proof_a: &[u8; 64],
    proof_b: &[u8; 128],
    proof_c: &[u8; 64],
    public_inputs: &WithdrawPublicInputs,
    verification_key: &crate::state::Groth16VerifyingKey,
) -> Result<()> {
    let light_vk = Groth16Verifyingkey {
        nr_pubinputs: 7,
        vk_alpha_g1: verification_key.alpha,
        vk_beta_g2: verification_key.beta,
        vk_gamme_g2: verification_key.gamma,
        vk_delta_g2: verification_key.delta,
        vk_ic: &verification_key.ic,
    };

    let public_inputs_array: [[u8; 32]; 7] = [
        public_inputs.root,
        public_inputs.nullifier_hash,
        public_inputs.recipient_1,
        public_inputs.recipient_2,
        public_inputs.relayer_1,
        public_inputs.relayer_2,
        public_inputs.fee,
    ];

    let mut verifier = Groth16Verifier::new(
        proof_a,
        proof_b,
        proof_c,
        &public_inputs_array,
        &light_vk,
    ).map_err(|_| ErrorCode::InvalidProof)?;

    verifier.verify().map_err(|_| ErrorCode::InvalidProof)?;
    
    Ok(())
}

fn reconstruct_solana_pubkey(
    part1: [u8; 32],
    part2: [u8; 32],
) -> Result<Pubkey> {
    let mut full_key = [0u8; 32];
    full_key[..16].copy_from_slice(&part1[..16]);
    full_key[16..].copy_from_slice(&part2[..16]);
    Ok(Pubkey::new_from_array(full_key))
}

#[event]
pub struct WithdrawEvent {
    pub nullifier_hash: [u8; 32],
    pub recipient: Pubkey,
    pub timestamp: i64,
}
