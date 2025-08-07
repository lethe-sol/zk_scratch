use anchor_lang::prelude::*;

#[account]
pub struct TornadoPool {
    pub authority: Pubkey,
    pub deposit_amount: u64,
    pub deposit_count: u64,
    pub verification_key: Groth16VerifyingKey,
    pub merkle_tree: Pubkey,
    pub nullifier_queue: Pubkey,
    pub bump: u8,
}

impl TornadoPool {
    pub const LEN: usize = 32 + 8 + 8 + 256 + 32 + 32 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct Groth16VerifyingKey {
    pub alpha: [u8; 64],
    pub beta: [u8; 128],
    pub gamma: [u8; 128],
    pub delta: [u8; 128],
    pub ic: Vec<[u8; 64]>,
}
