use anchor_lang::prelude::*;
use crate::constants::MAX_RECENT_ROOTS;

#[account]
pub struct VaultState {
    pub merkle_tree: Pubkey,
    
    pub recent_roots: [Option<[u8; 32]>; MAX_RECENT_ROOTS],
    
    pub recent_roots_index: u8,
    
    pub deposit_amount: u64,
    
    pub total_deposits: u64,
    
    pub total_withdrawals: u64,
    
    pub authority: Pubkey,
    
    pub bump: u8,
}

impl VaultState {
    pub const LEN: usize = 8 + // discriminator
        32 + // merkle_tree
        (1 + 32) * MAX_RECENT_ROOTS + // recent_roots (Option<[u8; 32]>)
        1 + // recent_roots_index
        8 + // deposit_amount
        8 + // total_deposits
        8 + // total_withdrawals
        32 + // authority
        1; // bump

    pub fn add_recent_root(&mut self, root: [u8; 32]) -> Result<()> {
        self.recent_roots[self.recent_roots_index as usize] = Some(root);
        self.recent_roots_index = (self.recent_roots_index + 1) % (MAX_RECENT_ROOTS as u8);
        Ok(())
    }

    pub fn is_valid_root(&self, root: &[u8; 32]) -> bool {
        self.recent_roots.iter().any(|stored_root| {
            if let Some(stored) = stored_root {
                stored == root
            } else {
                false
            }
        })
    }
}

#[account]
pub struct NullifierPDA {
    pub nullifier_hash: [u8; 32],
    pub bump: u8,
}

impl NullifierPDA {
    pub const LEN: usize = 8 + // discriminator
        32 + // nullifier_hash
        1; // bump
}
