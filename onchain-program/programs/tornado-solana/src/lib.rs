use anchor_lang::prelude::*;

pub mod instructions;
pub mod state;
pub mod errors;
pub mod merkle_tree;

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
        proof_a: [u8; 64],
        proof_b: [u8; 128],
        proof_c: [u8; 64],
        public_inputs: WithdrawPublicInputs,
        merkle_proof: Vec<[u8; 32]>,
        path_indices: Vec<bool>,
    ) -> Result<()> {
        instructions::withdraw::process_withdraw(
            ctx,
            proof_a,
            proof_b,
            proof_c,
            public_inputs,
            merkle_proof,
            path_indices,
        )
    }
}
