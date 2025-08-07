use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid proof provided")]
    InvalidProof,
    #[msg("Invalid recipient address")]
    InvalidRecipient,
    #[msg("Insufficient funds for deposit")]
    InsufficientFunds,
    #[msg("Invalid verification key")]
    InvalidVerificationKey,
    #[msg("Merkle tree is full")]
    TreeFull,
    #[msg("Invalid proof length")]
    InvalidProofLength,
    #[msg("Nullifier already used")]
    NullifierAlreadyUsed,
    #[msg("Invalid merkle proof")]
    InvalidMerkleProof,
    #[msg("Hashing error")]
    HashingError,
}
