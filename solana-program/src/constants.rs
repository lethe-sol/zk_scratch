use anchor_lang::prelude::*;

#[constant]
pub const VAULT_SEED: &[u8] = b"vault";

#[constant]
pub const STATE_SEED: &[u8] = b"state";

#[constant]
pub const NULLIFIER_SEED: &[u8] = b"nullifier";

pub const MAX_RECENT_ROOTS: usize = 100;

pub const MERKLE_TREE_LEVELS: usize = 20;

pub const DEPOSIT_AMOUNT: u64 = 100_000_000;

pub const ACCOUNT_COMPRESSION_PROGRAM_ID: &str = "compr6CUsB5m2jS4Y3831ztGSTnDpnKJTKS95d64XVq";
