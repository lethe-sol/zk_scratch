use anchor_lang::prelude::*;

#[error_code]
pub enum TornadoError {
    #[msg("Invalid proof")]
    InvalidProof,
    
    #[msg("Nullifier already spent")]
    NullifierAlreadySpent,
    
    #[msg("Invalid merkle root")]
    InvalidMerkleRoot,
    
    #[msg("Insufficient vault balance")]
    InsufficientVaultBalance,
    
    #[msg("Invalid deposit amount")]
    InvalidDepositAmount,
    
    #[msg("Recent roots buffer full")]
    RecentRootsBufferFull,
    
    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,
    
    #[msg("Invalid recipient")]
    InvalidRecipient,
}
