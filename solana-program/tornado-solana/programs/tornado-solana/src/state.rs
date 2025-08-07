use anchor_lang::prelude::*;

#[account]
pub struct TornadoState {
    pub authority: Pubkey,           // Program authority
    pub merkle_tree: Pubkey,         // SPL compressed merkle tree account
    pub deposit_count: u64,          // Total deposits made
    pub verifying_key_initialized: bool, // Flag to indicate verifying key is set
}

impl TornadoState {
    pub const LEN: usize = 8 + 32 + 32 + 8 + 1; // discriminator + authority + merkle_tree + deposit_count + verifying_key_initialized
}

#[account]
pub struct NullifierMarker {
    pub nullifier_hash: [u8; 32],   // The nullifier hash that was spent
}

impl NullifierMarker {
    pub const LEN: usize = 8 + 32; // discriminator + nullifier_hash
}
