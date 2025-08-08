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
    /// - Validates the provided Merkle tree account is owned by SPL Account Compression
    /// - Stores the tree pubkey in config
    pub fn initialize(
        ctx: Context<Initialize>,
        _max_depth: u32,
        _max_buffer_size: u32,
    ) -> Result<()> {
        // Tree must be owned by SPL Account Compression
        require_keys_eq!(*ctx.accounts.merkle_tree.owner, CMT_ID);

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
        require_keys_eq!(ctx.accounts.compression_program.key(), CMT_ID);
        require_keys_eq!(ctx.accounts.noop_program.key(), NOOP_ID);
        require_keys_eq!(ctx.accounts.merkle_tree.key(), ctx.accounts.config.merkle_tree);

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

    /// Withdraw 0.1 SOL with a valid Groth16 proof.
    ///
    /// Public inputs expected by the VK/circuit (order matters):
    ///  1) root
    ///  2) nullifierHash
    ///  3) recipient_1  (first 16B of recipient pubkey, encoded as 32B BE field)
    ///  4) recipient_2  (last 16B)
    ///  5) relayer_1    (0 for now)
    ///  6) relayer_2    (0 for now)
    ///  7) fee          (0 for now)
    pub fn withdraw(
        ctx: Context<Withdraw>,
        proof: [u8; 256],
        root: [u8; 32],
        nullifier_hash: [u8; 32],
        _recipient: Pubkey, // kept for IDL clarity; we bind to accounts.recipient below
    ) -> Result<()> {
        use groth16_solana::groth16::Groth16Verifier;

        // --- marshal proof bytes (A|B|C) ---
        let proof_a: [u8; 64]  = proof[0..64].try_into().unwrap();
        let proof_b: [u8;128]  = proof[64..192].try_into().unwrap();
        let proof_c: [u8; 64]  = proof[192..256].try_into().unwrap();

        // --- build 7 public inputs in circuit order ---
        // embed a 16B chunk into a 32B field element (big-endian: place at the tail)
        fn be16_to_fe32(x: &[u8;16]) -> [u8;32] {
            let mut out = [0u8;32];
            out[16..].copy_from_slice(x);
            out
        }

        // Bind proof to the *recipient account* that will receive funds.
        let rb = ctx.accounts.recipient.key().to_bytes();
        let mut r_hi = [0u8;16]; r_hi.copy_from_slice(&rb[0..16]);
        let mut r_lo = [0u8;16]; r_lo.copy_from_slice(&rb[16..32]);

        let recipient_1 = be16_to_fe32(&r_hi);
        let recipient_2 = be16_to_fe32(&r_lo);

        // Not using relayer/fee yet — keep them zero (must match prover inputs)
        let relayer_1 = [0u8;32];
        let relayer_2 = [0u8;32];
        let fee_fe    = [0u8;32];

        let public_inputs: [[u8;32]; 7] = [
            root,
            nullifier_hash,
            recipient_1,
            recipient_2,
            relayer_1,
            relayer_2,
            fee_fe,
        ];

        // --- verify Groth16 proof against the embedded VK ---
        let mut verifier = Groth16Verifier::new(
            &proof_a,
            &proof_b,
            &proof_c,
            &public_inputs, // <- pass the array directly
            &VERIFYING_KEY,
        ).map_err(|_| MixerError::InvalidProof)?;
        verifier.verify().map_err(|_| MixerError::InvalidProof)?;

        // TODO (soon): require! that `root` ∈ accepted roots window kept in `config`

        // Payout fixed denomination from vault PDA to recipient
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
