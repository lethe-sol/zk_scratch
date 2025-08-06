use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid ZK proof provided")]
    InvalidProof,
    
    #[msg("Invalid recipient address")]
    InvalidRecipient,
    
    #[msg("Nullifier already used")]
    NullifierAlreadyUsed,
    
    #[msg("Invalid merkle root")]
    InvalidMerkleRoot,
    
    #[msg("Insufficient funds in pool")]
    InsufficientFunds,
    
    #[msg("Invalid deposit amount")]
    InvalidDepositAmount,
    
    #[msg("Invalid commitment")]
    InvalidCommitment,
    
    #[msg("Serialization error")]
    SerializationError,
}
