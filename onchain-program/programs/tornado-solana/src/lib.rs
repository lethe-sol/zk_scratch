use anchor_lang::prelude::*;

pub mod instructions;
pub mod state;
pub mod errors;

use instructions::*;
use state::*;

declare_id!("9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM");

#[program]
pub mod tornado_solana {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        deposit_amount: u64,
        verification_key: Groth16VerifyingKey,
    ) -> Result<()> {
        instructions::initialize::process_initialize(ctx, deposit_amount, verification_key)
    }

    pub fn deposit(
        ctx: Context<Deposit>,
        commitment: [u8; 32],
    ) -> Result<()> {
        instructions::deposit::process_deposit(ctx, commitment)
    }

    pub fn withdraw(
        ctx: Context<Withdraw>,
        proof: groth16_solana::groth16::Groth16Proof,
        public_inputs: WithdrawPublicInputs,
        change_log_indices: Vec<u64>,
        leaves_queue_indices: Vec<u16>,
        leaf_indices: Vec<u64>,
        proofs: Vec<Vec<[u8; 32]>>,
    ) -> Result<()> {
        instructions::withdraw::process_withdraw(
            ctx,
            proof,
            public_inputs,
            change_log_indices,
            leaves_queue_indices,
            leaf_indices,
            proofs,
        )
    }
}
