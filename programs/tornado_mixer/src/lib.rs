use anchor_lang::prelude::*;

declare_id!("31zAuv25vz5tV8oiHuq49Zd827mNpbaaZ6P7da6hHB8g");

pub mod constants;
pub mod errors;
pub mod instructions;
pub mod state;
pub mod verifying_key;

#[program]
pub mod tornado_mixer {
    use super::*;
    use anchor_lang::prelude::Result; // Anchor's Result alias

    pub fn initialize(
        ctx: Context<instructions::Initialize>,
        deposit_amount: u64,
    ) -> Result<()> {
        instructions::initialize(ctx, deposit_amount)
    }

    pub fn deposit(
        ctx: Context<instructions::Deposit>,
        commitment: [u8; 32],
    ) -> Result<()> {
        instructions::deposit(ctx, commitment)
    }

    pub fn withdraw(
        ctx: Context<instructions::Withdraw>,
        proof: [u8; 256],
        root: [u8; 32],
        nullifier_hash: [u8; 32],
        recipient: Pubkey,
    ) -> Result<()> {
        instructions::withdraw(ctx, proof, root, nullifier_hash, recipient)
    }
}
