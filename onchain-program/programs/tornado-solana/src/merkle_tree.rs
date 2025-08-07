use anchor_lang::prelude::*;
use light_poseidon::Poseidon;

pub const TREE_DEPTH: usize = 20;
pub const MAX_STORED_NODES: usize = 1000; // Store only recent nodes, not full tree

#[account]
pub struct MerkleTree {
    pub bump: u8,
    pub next_index: u32,
    pub root: [u8; 32],
    pub historical_roots: [[u8; 32]; 100], // Store last 100 roots
    pub nodes: [[u8; 32]; MAX_STORED_NODES], // Store recent nodes only
}

impl MerkleTree {
    pub const LEN: usize = 8 + 1 + 4 + 32 + (32 * 100) + (32 * MAX_STORED_NODES);

    pub fn initialize(&mut self, bump: u8) -> Result<()> {
        self.bump = bump;
        self.next_index = 0;
        self.root = [0u8; 32];
        self.historical_roots = [[0u8; 32]; 100];
        self.nodes = [[0u8; 32]; MAX_STORED_NODES];
        Ok(())
    }

    pub fn insert(&mut self, commitment: [u8; 32]) -> Result<u32> {
        require!(self.next_index < (1u32 << TREE_DEPTH), crate::errors::ErrorCode::TreeFull);
        
        let leaf_index = self.next_index;
        let mut current_hash = commitment;
        let mut current_index = leaf_index;

        for level in 0..TREE_DEPTH {
            let is_right = (current_index & 1) == 1;
            let sibling_hash = self.get_zero_hash(level);

            current_hash = if is_right {
                self.poseidon_hash(&sibling_hash, &current_hash)?
            } else {
                self.poseidon_hash(&current_hash, &sibling_hash)?
            };

            current_index /= 2;
        }

        let root_index = (self.next_index as usize) % 100;
        self.historical_roots[root_index] = self.root;
        
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

    fn get_zero_hash(&self, level: usize) -> [u8; 32] {
        [0u8; 32]
    }

    pub fn is_valid_root(&self, root: [u8; 32]) -> bool {
        if root == self.root {
            return true;
        }
        
        for historical_root in &self.historical_roots {
            if *historical_root == root {
                return true;
            }
        }
        
        false
    }

    fn poseidon_hash(&self, left: &[u8; 32], right: &[u8; 32]) -> Result<[u8; 32]> {
        let mut hasher = Poseidon::new();
        hasher.hash(&[*left, *right])
            .map_err(|_| crate::errors::ErrorCode::HashingError)
    }
}

#[account]
pub struct NullifierSet {
    pub bump: u8,
    pub nullifiers: Vec<[u8; 32]>,
}

impl NullifierSet {
    pub const LEN: usize = 8 + 1 + 4 + (32 * 100); // Support up to 100 nullifiers initially

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
