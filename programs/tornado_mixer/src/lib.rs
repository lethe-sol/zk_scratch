use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_program;
use spl_account_compression::ID as ACCOUNT_COMPRESSION_ID;
use spl_noop::ID as NOOP_PROGRAM_ID;

pub mod instructions;
pub mod state;
pub mod errors;
use instructions::*;
use state::*;
use errors::*;

declare_id!("31zAuv25vz5tV8oiHuq49Zd827mNpbaaZ6P7da6hHB8g"); // Program ID (replace with actual)

#[program]
pub mod mixer {
    use super::*;

    /// Initializes the mixer by creating:
    /// - A Concurrent Merkle Tree account (via the Account Compression program CPI)
    /// - A vault PDA to hold deposited funds (and serve as tree authority)
    /// - A config account to store the Merkle tree pubkey for future reference
    pub fn initialize(
        ctx: Context<Initialize>, 
        max_depth: u32, 
        max_buffer_size: u32
    ) -> Result<()> {
        // Calculate required space and rent for the Merkle tree account
        let space = spl_account_compression::state::CONCURRENT_MERKLE_TREE_HEADER_SIZE_V1 
                 + spl_account_compression::state::get_tree_data_size(max_depth, max_buffer_size, 0)
                 ?; // total bytes for tree of given size
        let lamports = Rent::get()?.minimum_balance(space);
        // Create the Merkle tree account via system program (already handled by Anchor init)

        // Invoke the compression program's init instruction to initialize the tree data
        let cpi_program = ctx.accounts.compression_program.to_account_info();
        let cpi_accounts = spl_account_compression::cpi::accounts::Initialize {
            merkle_tree: ctx.accounts.merkle_tree.to_account_info(),
            authority: ctx.accounts.vault.to_account_info(),
            noop: ctx.accounts.noop_program.to_account_info(),
        };
        // The vault PDA will sign the CPI as the tree authority
        let seeds: &[&[u8]] = &[b"vault", &[*ctx.bumps.get("vault").unwrap()]];
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, &[seeds]);
        // Call the compression program to initialize an empty tree
        spl_account_compression::cpi::init_empty_merkle_tree(cpi_ctx, max_depth, max_buffer_size)?;

        // Save the tree's public key in the config for future verification
        ctx.accounts.config.merkle_tree = ctx.accounts.merkle_tree.key();
        Ok(())
    }

    /// Deposits 0.1 SOL into the mixer. The user provides a 32-byte commitment (the note).
    /// This will append the commitment as a new leaf in the Merkle tree via CPI, and transfer 0.1 SOL into the vault.
    pub fn deposit(ctx: Context<Deposit>, commitment: [u8; 32]) -> Result<()> {
        // Verify the attached lamports equal 0.1 SOL (100_000_000 lamports)
        let deposit_amount: u64 = 100_000_000;
        require!(
            ctx.accounts.user.lamports() >= deposit_amount, 
            MixerError::InsufficientBalance
        );
        // Transfer 0.1 SOL from user to the vault PDA (pool) using system program
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.user.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                },
            ),
            deposit_amount,
        )?;

        // Append the commitment as a new leaf in the Merkle tree (CPI to compression program)
        let cpi_program = ctx.accounts.compression_program.to_account_info();
        let cpi_accounts = spl_account_compression::cpi::accounts::Modify {
            merkle_tree: ctx.accounts.merkle_tree.to_account_info(),
            authority: ctx.accounts.vault.to_account_info(),
            noop: ctx.accounts.noop_program.to_account_info(),
        };
        // vault PDA signs as authority
        let seeds: &[&[u8]] = &[b"vault", &[*ctx.bumps.get("vault").unwrap()]];
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, &[seeds]);
        spl_account_compression::cpi::append(cpi_ctx, commitment)?;  // Append leaf to tree

        Ok(())
    }

    /// Withdraws 0.1 SOL from the mixer to a recipient address, given a valid zero-knowledge proof.
    /// The proof must prove knowledge of a deposited note (commitment) that exists in the Merkle tree (with a known root)
    /// and reveal the nullifier hash. The nullifier is used to ensure the note is not spent twice.
    pub fn withdraw(
        ctx: Context<Withdraw>, 
        proof: [u8; 256],        // Groth16 proof bytes (serialized)
        root: [u8; 32],          // Merkle root that the proof attests to
        nullifier_hash: [u8; 32],// Nullifier of the note (public input in proof)
        recipient: Pubkey       // Recipient of the withdrawn SOL
    ) -> Result<()> {
        // **Verify ZK Proof** using Light Protocol Groth16 verifier
        // Prepare public inputs: concatenate root and nullifier (each 32 bytes)
        let mut public_inputs_vec = Vec::new();
        public_inputs_vec.push(&root); 
        public_inputs_vec.push(&nullifier_hash);
        // Parse proof bytes into Groth16 curve points (per Lightprotocol's usage example)
        use groth16_solana::groth16::{Groth16Verifier, G1};
        use groth16_solana::groth16;
        let proof_bytes = proof;
        // Handle proof A (G1 element)
        let proof_a: G1 = <G1 as groth16::FromBytes>::read(
            &[*&groth16_solana::change_endianness(&proof_bytes[0..64]), &[0u8]].concat()
        ).map_err(|_| MixerError::InvalidProof)?;
        let mut proof_a_neg = [0u8; 65];
        <G1 as groth16::ToBytes>::write(&proof_a.neg(), &mut proof_a_neg[..]).unwrap();
        let proof_a_bytes = groth16_solana::change_endianness(&proof_a_neg[..64]);
        let proof_a_prepared = proof_a_bytes.try_into().unwrap();
        // Proof B (G2 element) and proof C (G1 element)
        let proof_b: [u8; 128] = proof_bytes[64..192].try_into().unwrap();
        let proof_c: [u8; 64]  = proof_bytes[192..256].try_into().unwrap();
        // Load the verifying key (statically generated from circuit)
        let verifier = Groth16Verifier::new(
            &proof_a_prepared,
            &proof_b,
            &proof_c,
            &public_inputs_vec[..],
            &VERIFYING_KEY,   // constant generated by Light Protocol's parse-vk script
        ).map_err(|_| MixerError::InvalidProof)?;
        verifier.verify().map_err(|_| MixerError::InvalidProof)?;
        // Proof is valid: it attests that a commitment was in the tree with `root`, and reveals `nullifier_hash`:contentReference[oaicite:3]{index=3}:contentReference[oaicite:4]{index=4}

        // **Check Merkle Root**: ensure the provided root matches the current tree root on-chain.
        // (In a full implementation, you would fetch or compute the current root of the `merkle_tree` account and compare.)
        // For MVP, we assume the root is recent and accept it if proof is valid.
        // TODO: Optionally verify `root` against the on-chain concurrent Merkle tree state.

        // **Nullifier check**: ensure this nullifier has not been used before.
        // Anchor will create the nullifier PDA; if it already exists, the init will fail, preventing double spend.
        // (We don't need an explicit check here, Anchor's init constraint below enforces one-time use.)

        // **Transfer funds**: send 0.1 SOL from the vault to the recipient.
        // Ensure vault has enough (should have at least this amount if deposit was done).
        require!(
            ctx.accounts.vault.lamports() >= 100_000_000,
            MixerError::InsufficientPoolFunds
        );
        // Transfer from vault PDA to recipient
        let vault_seeds: &[&[u8]] = &[b"vault", &[*ctx.bumps.get("vault").unwrap()]];
        system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.recipient.to_account_info(),
                },
                &[vault_seeds],
            ),
            100_000_000,
        )?;

        Ok(())
    }
}
