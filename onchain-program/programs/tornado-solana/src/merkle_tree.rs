use anchor_lang::prelude::*;
use light_poseidon::{Poseidon, PoseidonHasher};

pub const TREE_DEPTH: usize = 20;
pub const TREE_SIZE: usize = (1 << TREE_DEPTH) - 1; // 2^20 - 1 internal nodes

#[account]
pub struct MerkleTree {
    pub bump: u8,
    pub next_index: u32,
    pub root: [u8; 32],
    pub nodes: [[u8; 32]; TREE_SIZE],
}

impl MerkleTree {
    pub const LEN: usize = 8 + 1 + 4 + 32 + (32 * TREE_SIZE);

    pub fn initialize(&mut self, bump: u8) -> Result<()> {
        self.bump = bump;
        self.next_index = 0;
        self.root = [0u8; 32];
        self.nodes = [[0u8; 32]; TREE_SIZE];
        Ok(())
    }

    pub fn insert(&mut self, commitment: [u8; 32]) -> Result<u32> {
        require!(self.next_index < (1u32 << TREE_DEPTH), crate::errors::ErrorCode::TreeFull);
        
        let leaf_index = self.next_index;
        let mut current_hash = commitment;
        let mut current_index = leaf_index;

        for level in 0..TREE_DEPTH {
            let is_right = (current_index & 1) == 1;
            let sibling_index = if is_right { current_index - 1 } else { current_index + 1 };
            
            let sibling_hash = if sibling_index < (1u32 << (TREE_DEPTH - level)) {
                if level == 0 {
                    [0u8; 32] // Empty leaf
                } else {
                    let node_index = self.get_node_index(level - 1, sibling_index);
                    self.nodes[node_index]
                }
            } else {
                [0u8; 32] // Empty sibling
            };

            current_hash = if is_right {
                self.poseidon_hash(&sibling_hash, &current_hash)?
            } else {
                self.poseidon_hash(&current_hash, &sibling_hash)?
            };

            if level < TREE_DEPTH - 1 {
                let node_index = self.get_node_index(level, current_index);
                self.nodes[node_index] = current_hash;
            }

            current_index /= 2;
        }

        self.root = current_hash;
        self.next_index += 1;
        
        Ok(leaf_index)
    }

    pub fn verify_proof(
        &self,
        leaf: [u8; 32],
        proof: &[[u8; 32]],
        path_indices: &[bool],
        leaf_index: u32,
    ) -> Result<bool> {
        require!(proof.len() == TREE_DEPTH, crate::errors::ErrorCode::InvalidProofLength);
        require!(path_indices.len() == TREE_DEPTH, crate::errors::ErrorCode::InvalidProofLength);

        let mut current_hash = leaf;
        let mut current_index = leaf_index;

        for i in 0..TREE_DEPTH {
            let is_right = path_indices[i];
            let sibling = proof[i];

            current_hash = if is_right {
                self.poseidon_hash(&sibling, &current_hash)?
            } else {
                self.poseidon_hash(&current_hash, &sibling)?
            };

            current_index /= 2;
        }

        Ok(current_hash == self.root)
    }

    fn get_node_index(&self, level: usize, index: u32) -> usize {
        let level_offset = (1usize << level) - 1;
        level_offset + (index as usize)
    }

    fn poseidon_hash(&self, left: &[u8; 32], right: &[u8; 32]) -> Result<[u8; 32]> {
        let mut hasher = Poseidon::new();
        hasher.hash(&[*left, *right]).map_err(|_| crate::errors::ErrorCode::HashingError.into())
    }
}

#[account]
pub struct NullifierSet {
    pub bump: u8,
    pub nullifiers: Vec<[u8; 32]>,
}

impl NullifierSet {
    pub const LEN: usize = 8 + 1 + 4 + (32 * 1000); // Support up to 1000 nullifiers initially

    pub fn initialize(&mut self, bump: u8) -> Result<()> {
        self.bump = bump;
        self.nullifiers = Vec::new();
        Ok(())
    }

    pub fn add_nullifier(&mut self, nullifier: [u8; 32]) -> Result<()> {
        require!(!self.contains(&nullifier), crate::errors::ErrorCode::NullifierAlreadyUsed);
        self.nullifiers.push(nullifier);
        Ok(())
    }

    pub fn contains(&self, nullifier: &[u8; 32]) -> bool {
        self.nullifiers.contains(nullifier)
    }
}
