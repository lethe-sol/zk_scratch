use anchor_lang::prelude::*;

#[account]
pub struct TornadoPool {
    pub authority: Pubkey,                    // Program authority
    pub deposit_amount: u64,                  // Fixed SOL amount (e.g., 0.1 SOL)
    pub deposit_count: u64,                   // Total deposits made
    pub verification_key: Groth16VerifyingKey, // Embedded from our circuits
    pub merkle_tree: Pubkey,                  // Light Protocol compressed Merkle tree
    pub nullifier_queue: Pubkey,              // Light Protocol nullifier queue
    pub bump: u8,                             // PDA bump
}

impl TornadoPool {
    pub const LEN: usize = 32 + 8 + 8 + 256 + 32 + 32 + 1; // Approximate size
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct Groth16VerifyingKey {
    pub alpha: [u8; 64],      // G1 point
    pub beta: [u8; 128],      // G2 point  
    pub gamma: [u8; 128],     // G2 point
    pub delta: [u8; 128],     // G2 point
    pub ic: Vec<[u8; 64]>,    // G1 points array (8 points for 7 public inputs + 1)
}
