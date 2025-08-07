use anchor_lang::prelude::*;

#[account]
pub struct TornadoPool {
    pub bump: u8,
    pub deposit_amount: u64,
    pub deposit_count: u64,
    pub verification_key_account: Pubkey,
}

impl TornadoPool {
    pub const LEN: usize = 8 + 1 + 8 + 8 + 32;
}

#[account]
pub struct VerificationKeyAccount {
    pub bump: u8,
    pub verification_key: Groth16VerifyingKey,
}

impl VerificationKeyAccount {
    pub const LEN: usize = 8 + 1 + Groth16VerifyingKey::LEN;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct Groth16VerifyingKey {
    pub alpha: [u8; 64],
    pub beta: [u8; 128],
    pub gamma: [u8; 128],
    pub delta: [u8; 128],
    pub ic: Vec<[u8; 64]>,
}

impl Groth16VerifyingKey {
    pub const LEN: usize = 64 + 128 + 128 + 128 + 4 + (64 * 8);
}
