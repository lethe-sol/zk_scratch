use anchor_lang::prelude::*;

declare_id!("31zAuv25vz5tV8oiHuq49Zd827mNpbaaZ6P7da6hHB8g");

pub mod constants;
pub mod errors;
pub mod ix;       // <- renamed from `instructions`
pub mod state;
pub mod verifying_key;

use ix::{initialize::Initialize, deposit::Deposit, withdraw::Withdraw};

#[program]
pub mod tornado_mixer {
    use super::*;
    use anchor_lang::prelude::Result;

    pub fn initialize(ctx: Context<Initialize>, deposit_amount: u64) -> Result<()> {
        ix::initialize::initialize(ctx, deposit_amount)
    }

    pub fn deposit(ctx: Context<Deposit>, commitment: [u8; 32]) -> Result<()> {
        ix::deposit::deposit(ctx, commitment)
    }

    pub fn withdraw(
        ctx: Context<Withdraw>,
        proof: [u8; 256],
        root: [u8; 32],
        nullifier_hash: [u8; 32],
        recipient: Pubkey,
    ) -> Result<()> {
        ix::withdraw::withdraw(ctx, proof, root, nullifier_hash, recipient)
    }
}
