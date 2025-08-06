use anchor_lang::prelude::*;
use groth16_solana::groth16::{Groth16Verifier, Groth16Proof};
use light_account_compression::{
    program::LightAccountCompression,
    RegisteredProgram,
};

use crate::state::TornadoPool;
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
    
    #[account(mut)]
    pub recipient: UncheckedAccount<'info>,
    
    pub authority: Signer<'info>,
    pub registered_program_pda: Option<Account<'info, RegisteredProgram>>,
    pub log_wrapper: UncheckedAccount<'info>,
    #[account(mut)]
    pub merkle_tree: AccountInfo<'info>,
    #[account(mut)]
    pub nullifier_queue: AccountInfo<'info>,
    
    pub account_compression_program: Program<'info, LightAccountCompression>,
    pub system_program: Program<'info, System>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct WithdrawPublicInputs {
    pub root: [u8; 32],           // Current Merkle tree root
    pub nullifier_hash: [u8; 32], // Hash of nullifier (prevents double-spend)
    pub recipient_1: [u8; 32],    // First half of recipient Solana pubkey
    pub recipient_2: [u8; 32],    // Second half of recipient Solana pubkey  
    pub relayer_1: [u8; 32],      // First half of relayer pubkey (future use)
    pub relayer_2: [u8; 32],      // Second half of relayer pubkey (future use)
    pub fee: [u8; 32],           // Relayer fee (currently 0)
}

pub fn process_withdraw(
    ctx: Context<Withdraw>,
    proof: Groth16Proof,
    public_inputs: WithdrawPublicInputs,
    change_log_indices: Vec<u64>,
    leaves_queue_indices: Vec<u16>,
    leaf_indices: Vec<u64>,
    proofs: Vec<Vec<[u8; 32]>>,
) -> Result<()> {
    let tornado_pool = &mut ctx.accounts.tornado_pool;
    
    let verifier = Groth16Verifier::new(&tornado_pool.verification_key)?;
    
    let public_inputs_bytes = [
        public_inputs.root,
        public_inputs.nullifier_hash,
        public_inputs.recipient_1,
        public_inputs.recipient_2,
        public_inputs.relayer_1,
        public_inputs.relayer_2,
        public_inputs.fee,
    ];
    
    let is_valid = verifier.verify_proof(
        &proof.pi_a,
        &proof.pi_b,
        &proof.pi_c,
        &public_inputs_bytes,
    )?;
    
    require!(is_valid, ErrorCode::InvalidProof);
    
    let recipient_pubkey = reconstruct_solana_pubkey(
        public_inputs.recipient_1,
        public_inputs.recipient_2,
    )?;
    
    require_keys_eq!(
        recipient_pubkey,
        ctx.accounts.recipient.key(),
        ErrorCode::InvalidRecipient
    );
    
    let cpi_accounts = light_account_compression::cpi::accounts::NullifyLeaves {
        authority: ctx.accounts.authority.to_account_info(),
        registered_program_pda: ctx.accounts.registered_program_pda.as_ref().map(|a| a.to_account_info()),
        log_wrapper: ctx.accounts.log_wrapper.to_account_info(),
        merkle_tree: ctx.accounts.merkle_tree.to_account_info(),
        nullifier_queue: ctx.accounts.nullifier_queue.to_account_info(),
    };
    
    let cpi_ctx = CpiContext::new(
        ctx.accounts.account_compression_program.to_account_info(),
        cpi_accounts,
    );
    
    light_account_compression::cpi::nullify_leaves(
        cpi_ctx,
        change_log_indices,
        leaves_queue_indices,
        leaf_indices,
        proofs,
    )?;
    
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
