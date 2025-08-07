use anchor_lang::prelude::*;
use anchor_spl::token::Token;
use spl_account_compression::{program::SplAccountCompression, Noop};

declare_id!("DN3cDXsro55LEXrMwueUXci6EMJhomoHNFEh5LXceTF9");

pub mod instructions;
pub mod state;
pub mod errors;
pub mod events;
pub mod verifying_key;

use instructions::*;
use state::*;
use errors::*;
use events::*;

#[program]
pub mod tornado_solana {
    use super::*;

    pub fn initialize_tree(ctx: Context<InitializeTree>) -> Result<()> {
        instructions::initialize_tree::handler(ctx)
    }

    pub fn deposit(ctx: Context<Deposit>, commitment: [u8; 32]) -> Result<()> {
        instructions::deposit::handler(ctx, commitment)
    }

    pub fn withdraw(
        ctx: Context<Withdraw>,
        proof_a: [u8; 64],
        proof_b: [u8; 128],
        proof_c: [u8; 64],
        public_inputs: [[u8; 32]; 7],
        nullifier_hash: [u8; 32],
    ) -> Result<()> {
        instructions::withdraw::handler(ctx, proof_a, proof_b, proof_c, public_inputs, nullifier_hash)
    }
}
