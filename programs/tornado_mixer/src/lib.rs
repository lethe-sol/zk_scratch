// programs/tornado_mixer/src/lib.rs
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

    pub fn initialize(
        ctx: Context<Initialize>,
        _max_depth: u32,
        _max_buffer_size: u32,
    ) -> Result<()> {
        require_keys_eq!(*ctx.accounts.merkle_tree.owner, CMT_ID);

        ctx.accounts
            .config
            .set_inner(MixerConfig { merkle_tree: ctx.accounts.merkle_tree.key() });

        msg!("Initialized with Merkle tree = {}", ctx.accounts.merkle_tree.key());
        Ok(())
    }

    pub fn deposit(ctx: Context<Deposit>, commitment: [u8; 32]) -> Result<()> {
        require_keys_eq!(ctx.accounts.compression_program.key(), CMT_ID);
        require_keys_eq!(ctx.accounts.noop_program.key(), NOOP_ID);
        require_keys_eq!(ctx.accounts.merkle_tree.key(), ctx.accounts.config.merkle_tree);

        const DEPOSIT_LAMPORTS: u64 = 100_000_000;

        let cpi = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            Transfer {
                from: ctx.accounts.user.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
            },
        );
        system_program::transfer(cpi, DEPOSIT_LAMPORTS)?;

        let accounts = spl_account_compression::cpi::accounts::Modify {
            merkle_tree: ctx.accounts.merkle_tree.to_account_info(),
            authority:   ctx.accounts.vault.to_account_info(),
            noop:        ctx.accounts.noop_program.to_account_info(),
        };

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

    pub fn withdraw(
        ctx: Context<Withdraw>,
        proof: [u8; 256],
        root: [u8; 32],
        nullifier_hash: [u8; 32],
        _recipient: Pubkey,
    ) -> Result<()> {
        use groth16_solana::groth16::Groth16Verifier;

        let proof_a: [u8; 64]  = proof[0..64].try_into().unwrap();
        let proof_b: [u8;128]  = proof[64..192].try_into().unwrap();
        let proof_c: [u8; 64]  = proof[192..256].try_into().unwrap();

        fn be16_to_fe32(x: &[u8;16]) -> [u8;32] {
            let mut out = [0u8;32];
            out[16..].copy_from_slice(x);
            out
        }

        let rb = ctx.accounts.recipient.key().to_bytes();
        let mut r_hi = [0u8;16]; r_hi.copy_from_slice(&rb[0..16]);
        let mut r_lo = [0u8;16]; r_lo.copy_from_slice(&rb[16..32]);

        let recipient_1 = be16_to_fe32(&r_hi);
        let recipient_2 = be16_to_fe32(&r_lo);

        let public_inputs: [[u8;32]; 7] = [
            root,
            nullifier_hash,
            recipient_1,
            recipient_2,
            [0u8;32],
            [0u8;32],
            [0u8;32],
        ];

        let mut verifier = Groth16Verifier::new(
            &proof_a,
            &proof_b,
            &proof_c,
            &public_inputs,
            &VERIFYING_KEY,
        ).map_err(|_| MixerError::InvalidProof)?;
        verifier.verify().map_err(|_| MixerError::InvalidProof)?;

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
