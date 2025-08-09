// programs/<your_program>/src/lib.rs
use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod state;

pub mod instructions {
    pub mod withdraw;
}

declare_id!("YourProgramId1111111111111111111111111111111");

#[program]
pub mod tornado_mixer {
    use super::*;

    /// Entry point for withdraw.
    /// Keep the signature the same as your client expects.
    pub fn withdraw(
        ctx: Context<instructions::withdraw::Withdraw>,
        proof: [u8; 256],
        root: [u8; 32],
        nullifier_hash: [u8; 32],
        recipient: Pubkey,
    ) -> Result<()> {
        // If you want to run Groth16 verification, do it either:
        //  - here, then call handler; or
        //  - inside the handler before PDA creation.
        //
        // Example (pseudo):
        // verify_groth16(&proof, &root, &nullifier_hash, &recipient)?;

        instructions::withdraw::handler(ctx, proof, root, nullifier_hash, recipient)
    }
}
