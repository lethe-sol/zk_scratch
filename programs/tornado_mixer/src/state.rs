use anchor_lang::prelude::*;

#[account]
pub struct MixerConfig {
    pub merkle_tree: Pubkey,  // the compressed Merkle tree account address
}

#[account]
pub struct NullifierState {
    // No fields needed, existence of this account = nullifier used
    // (Anchor will still assign an 8-byte discriminator)
}
