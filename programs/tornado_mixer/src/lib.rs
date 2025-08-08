use anchor_lang::prelude::*;
use anchor_lang::system_program::{self, Transfer};

pub mod instructions;
pub mod state;
pub mod errors;
pub mod verifying_key;

use instructions::*;
use state::*;
use errors::*;
use verifying_key::VERIFYING_KEY;

// SPL compression: header + size calc + wrappers
use spl_account_compression::state::{
    ConcurrentMerkleTreeHeader,
    CompressionAccountType,
    CONCURRENT_MERKLE_TREE_HEADER_SIZE_V1,
    merkle_tree_get_size,
};
use spl_account_compression::concurrent_tree_wrapper::{
    merkle_tree_initialize_empty,
    merkle_tree_append_leaf,
};

declare_id!("31zAuv25vz5tV8oiHuq49Zd827mNpbaaZ6P7da6hHB8g"); // replace with your real program id

#[program]
pub mod tornado_mixer {
    use super::*;

    // Create+init the Merkle tree owned by THIS program, plus the vault + config.
    pub fn initialize(
        ctx: Context<Initialize>,
        max_depth: u32,
        max_buffer_size: u32,
    ) -> Result<()> {
        // Build a header in memory first
        let mut header = ConcurrentMerkleTreeHeader {
            account_type: CompressionAccountType::ConcurrentMerkleTree,
            header: Default::default(),
        };
        header.initialize(
            max_depth,
            max_buffer_size,
            &ctx.accounts.vault.key(),   // vault is the tree authority
            Clock::get()?.slot,
        );
        header.assert_valid()?; // also enforces allowed depth/buffer pairs

        // Compute dynamic size and create the PDA if empty
        let tree_size = merkle_tree_get_size(&header)? as usize;
        let space = CONCURRENT_MERKLE_TREE_HEADER_SIZE_V1 + tree_size;
        if ctx.accounts.merkle_tree.data_is_empty() {
            let lamports = Rent::get()?.minimum_balance(space);
            let seeds = &[b"tree".as_ref(), &[ctx.bumps.merkle_tree]];
            let signer = &[&seeds[..]];
            let ix = anchor_lang::solana_program::system_instruction::create_account(
                &ctx.accounts.payer.key(),
                &ctx.accounts.merkle_tree.key(),
                lamports,
                space as u64,
                ctx.program_id,
            );
            anchor_lang::solana_program::program::invoke_signed(
                &ix,
                &[
                    ctx.accounts.payer.to_account_info(),
                    ctx.accounts.merkle_tree.to_account_info(),
                    ctx.accounts.system_program.to_account_info(),
                ],
                signer,
            )?;
        }

        // Serialize header + init tree bytes
        {
            let mut data = ctx.accounts.merkle_tree.try_borrow_mut_data()?;
            let (header_bytes, tree_bytes) =
                data.split_at_mut(CONCURRENT_MERKLE_TREE_HEADER_SIZE_V1);

            let ser = header.try_to_vec()?;
            require_eq!(ser.len(), CONCURRENT_MERKLE_TREE_HEADER_SIZE_V1, MixerError::InvalidState);
            header_bytes.copy_from_slice(&ser);

            // Initialize the empty tree in-place
            merkle_tree_initialize_empty(&header, ctx.accounts.merkle_tree.key(), tree_bytes)?;
        }

        // Store reference to the tree
        ctx.accounts.config.merkle_tree = ctx.accounts.merkle_tree.key();
        Ok(())
    }

    // User sends 0.1 SOL to the vault; we append their commitment as a new leaf.
    pub fn deposit(ctx: Context<Deposit>, commitment: [u8; 32]) -> Result<()> {
        // 0.1 SOL in lamports
        let deposit_amount: u64 = 100_000_000;

        // Transfer SOL user -> vault (system_program CPI)
        let cpi = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            Transfer {
                from: ctx.accounts.user.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
            },
        );
        system_program::transfer(cpi, deposit_amount)?; // standard way to move SOL in Anchor. :contentReference[oaicite:2]{index=2}

        // Append commitment to the tree (read header from account)
        let mut data = ctx.accounts.merkle_tree.try_borrow_mut_data()?;
        let (header_bytes, tree_bytes) =
            data.split_at_mut(CONCURRENT_MERKLE_TREE_HEADER_SIZE_V1);
        let header = ConcurrentMerkleTreeHeader::try_from_slice(header_bytes)?;
        header.assert_valid_authority(&ctx.accounts.vault.key())?;

        merkle_tree_append_leaf(
            &header,
            ctx.accounts.merkle_tree.key(),
            tree_bytes,
            &commitment,
        )?;
        Ok(())
    }

    // Withdraw 0.1 SOL with a valid Groth16 proof. Public inputs are [root, nullifier].
    pub fn withdraw(
        ctx: Context<Withdraw>,
        proof: [u8; 256],
        root: [u8; 32],
        nullifier_hash: [u8; 32],
        _recipient: Pubkey, // kept for IDL clarity, we use the account below
    ) -> Result<()> {
        // 1) Verify Groth16 proof (library expects big-endian inputs).
        //    NR_INPUTS = 2 here (root, nullifier). :contentReference[oaicite:3]{index=3}
        let proof_a: [u8; 64]   = proof[0..64].try_into().unwrap();
        let proof_b: [u8; 128]  = proof[64..192].try_into().unwrap();
        let proof_c: [u8; 64]   = proof[192..256].try_into().unwrap();
        let public_inputs: [[u8; 32]; 2] = [root, nullifier_hash];

        let mut verifier = groth16_solana::groth16::Groth16Verifier::<2>::new(
            &proof_a,
            &proof_b,
            &proof_c,
            &public_inputs,
            &VERIFYING_KEY,
        ).map_err(|_| MixerError::InvalidProof)?;
        verifier.verify().map_err(|_| MixerError::InvalidProof)?; // :contentReference[oaicite:4]{index=4}

        // 2) (Nullifier PDA is created by the Accounts context; if it already exists, init fails)

        // 3) Pay out 0.1 SOL from the vault PDA to the recipient.
        let vault_bump = ctx.bumps.vault;
        let signer_seeds: &[&[u8]] = &[b"vault", &[vault_bump]];
        let cpi = CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.recipient.to_account_info(),
            },
            &[signer_seeds],
        );
        system_program::transfer(cpi, 100_000_000)?;
        Ok(())
    }
}
