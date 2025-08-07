use anchor_lang::prelude::*;

#[account]
pub struct TornadoPool {
    pub bump: u8,
    pub deposit_amount: u64,
    pub deposit_count: u64,
    pub verification_key: Groth16VerifyingKey,
}

impl TornadoPool {
    pub const LEN: usize = 8 + 1 + 8 + 8 + Groth16VerifyingKey::LEN;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct Groth16VerifyingKey {
    pub alpha: [u8; 64],
    pub beta: Box<[u8; 128]>,
    pub gamma: Box<[u8; 128]>,
    pub delta: Box<[u8; 128]>,
    pub ic: Vec<[u8; 64]>,
}

impl Groth16VerifyingKey {
    pub const LEN: usize = 64 + 128 + 128 + 128 + 4 + (64 * 8); // Assuming max 8 IC elements
}
