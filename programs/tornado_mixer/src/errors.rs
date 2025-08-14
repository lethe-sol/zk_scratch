use anchor_lang::prelude::*;

#[error_code]
pub enum MixerError {
    #[msg("Invalid zero-knowledge proof provided.")]
    InvalidProof,
    #[msg("Nullifier has already been used (note already spent).")]
    NullifierAlreadyUsed,
    #[msg("Insufficient balance for deposit.")]
    InsufficientBalance,
    #[msg("Insufficient funds in mixer pool.")]
    InsufficientPoolFunds,
}
