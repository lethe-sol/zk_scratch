use anchor_lang::prelude::*;

#[error_code]
pub enum TornadoError {
    #[msg("Invalid Groth16 proof")]
    InvalidProof,
    #[msg("Nullifier already spent")]
    NullifierAlreadySpent,
    #[msg("Insufficient funds for deposit")]
    InsufficientFunds,
    #[msg("Invalid commitment format")]
    InvalidCommitment,
    #[msg("Invalid deposit amount - must be exactly 0.1 SOL")]
    InvalidDepositAmount,
    #[msg("Invalid public inputs")]
    InvalidPublicInputs,
    #[msg("Unauthorized")]
    Unauthorized,
}
