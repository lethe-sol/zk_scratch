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

use spl_account_compression::{program::SplAccountCompression, Noop, ID as CMT_ID};
use spl_noop::ID as NOOP_ID;

declare_id!("2xBPdkCzfwFdc6khqbvaAvYxWcKMRaueXeVyaLRoWDrN");

#[program]
pub mod tornado_mixer {
    use super::*;

    /// Initialize the mixer:
    /// - Creates the `vault` PDA (authority for the Merkle tree)
    /// - Accepts a **real SPL CMT** account (already created off-chain)
    /// - Stores the tree pubkey in `config`
    ///
    /// We keep the args to avoid IDL changes, but they are unused now.
    pub fn initialize(
        ctx: Context<Initialize>,
        _max_depth: u32,
        _max_buffer_size: u32,
    ) -> Result<()> {
        // Must be an SPL CMT account (owned by cmtDvXum…)
        require_keys_eq!(
            *ctx.accounts.merkle_tree.owner,
            CMT_ID,
            TornadoError::InvalidOwner
        );

        // Persist the tree so deposit() can validate against it later.
        ctx.accounts
            .config
            .set_inner(MixerConfig { merkle_tree: ctx.accounts.merkle_tree.key() });

        msg!("Initialized with Merkle tree = {}", ctx.accounts.merkle_tree.key());
        Ok(())
    }

    /// User sends 0.1 SOL to the vault; we append their commitment as a new leaf
    /// using a CPI to SPL Account Compression.
    pub fn deposit(ctx: Context<Deposit>, commitment: [u8; 32]) -> Result<()> {
        // Sanity checks so bad clients fail loudly.
        require_keys_eq!(
            ctx.accounts.compression_program.key(),
            CMT_ID,
            TornadoError::InvalidCompressionProgram
        );
        require_keys_eq!(
            ctx.accounts.noop_program.key(),
            NOOP_ID,
            TornadoError::InvalidNoopProgram
        );
        require_keys_eq!(
            ctx.accounts.merkle_tree.key(),
            ctx.accounts.config.merkle_tree,
            TornadoError::WrongTree
        );

        // 0.1 SOL in lamports
        const DEPOSIT_LAMPORTS: u64 = 100_000_000;

        // Transfer SOL user -> vault
        let cpi = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            Transfer {
                from: ctx.accounts.user.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
            },
        );
        system_program::transfer(cpi, DEPOSIT_LAMPORTS)?;

        // Append commitment to the SPL-owned tree (authority = vault PDA)
        let accounts = spl_account_compression::cpi::accounts::Modify {
            merkle_tree: ctx.accounts.merkle_tree.to_account_info(),
            authority:   ctx.accounts.vault.to_account_info(),
            noop:        ctx.accounts.noop_program.to_account_info(),
        };

        // Sign with the vault seeds
        let signer_seeds: &[&[u8]] = &[b"vault", &[ctx.bumps.vault]];
        spl_account_compression::cpi::append(
            CpiContext::new_with_signer(
                ctx.accounts.compression_program.to_account_info(),
                accounts,
                &[signer_seeds],
            ),
            commitment,
        )?;

        Ok(())
    }

    /// Withdraw 0.1 SOL with a valid Groth16 proof. Public inputs are [root, nullifier].
    pub fn withdraw(
        ctx: Context<Withdraw>,
        proof: [u8; 256],
        root: [u8; 32],
        nullifier_hash: [u8; 32],
        _recipient: Pubkey, // kept for IDL clarity, we use the account below
    ) -> Result<()> {
        // 1) Verify Groth16 proof (library expects big-endian inputs).
        //    NR_INPUTS = 2 here (root, nullifier).
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
        verifier.verify().map_err(|_| MixerError::InvalidProof)?;

        // 2) TODO: Nullifier handling (ensure one-time spend)

        // 3) Pay out 0.1 SOL from the vault PDA to the recipient.
        const WITHDRAW_LAMPORTS: u64 = 100_000_000;
        let signer_seeds: &[&[u8]] = &[b"vault", &[ctx.bumps.vault]];
        let signer = &[signer_seeds];

        let cpi = CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.recipient.to_account_info(),
            },
            signer,
        );
        system_program::transfer(cpi, WITHDRAW_LAMPORTS)?;
        Ok(())
    }
}
