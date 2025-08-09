// programs/<your_program>/src/instructions/withdraw.rs
use anchor_lang::prelude::*;
use anchor_lang::system_program::{self, Transfer};

use crate::constants::{NULLIFIER_SEED, VAULT_SEED};
use crate::errors::TornadoError;
use crate::state::MixerConfig;

/// NOTE: set this to your actual denomination or pull from config if you store it there.
const WITHDRAW_LAMPORTS: u64 = 0;

#[derive(Accounts)]
pub struct Withdraw<'info> {
    /// Pays for PDA creations (nullifier)
    #[account(mut)]
    pub payer: Signer<'info>,

    /// Mixer configuration (e.g., holds merkle tree pubkey, parameters, etc.)
    pub config: Account<'info, MixerConfig>,

    /// Vault PDA that holds funds; signs transfers via seeds.
    #[account(
        mut,
        seeds = [VAULT_SEED],
        bump
    )]
    pub vault: SystemAccount<'info>,

    /// Nullifier PDA **passed by the client**. We validate it in the handler.
    #[account(mut)]
    pub nullifier: UncheckedAccount<'info>,

    /// Recipient of the withdrawal (must match the public input in your proof)
    #[account(mut)]
    pub recipient: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

/// Handler called from the program entrypoint (see lib.rs).
///
/// Keep your proof verification exactly where it is in your flow; this file
/// only fixes the PDA/seed validation order so the instruction arg is available.
pub fn handler(
    ctx: Context<Withdraw>,
    _proof: [u8; 256],
    _root: [u8; 32],
    nullifier_hash: [u8; 32],
    _recipient_pubkey: Pubkey,
) -> Result<()> {
    // 1) Derive expected nullifier PDA **from the real argument bytes**
    let seeds_no_bump: &[&[u8]] = &[NULLIFIER_SEED, &nullifier_hash];
    let (expected_nullifier, nbump) =
        Pubkey::find_program_address(seeds_no_bump, ctx.program_id);

    // 2) Validate caller-provided nullifier account matches PDA
    require_keys_eq!(
        expected_nullifier,
        ctx.accounts.nullifier.key(),
        TornadoError::SeedsMismatch
    );

    // 3) If the nullifier account doesn't exist yet, create it and mark as spent.
    if ctx.accounts.nullifier.data_is_empty() {
        // Just the 8-byte Anchor discriminator if your NullifierState has no fields.
        let space: usize = 8;
        let lamports = Rent::get()?.minimum_balance(space);

        let ix = system_program::create_account(
            &ctx.accounts.payer.key(),
            &expected_nullifier,
            lamports,
            space as u64,
            ctx.program_id,
        );

        let signer_seeds: &[&[u8]] = &[NULLIFIER_SEED, &nullifier_hash, &[nbump]];
        anchor_lang::solana_program::program::invoke_signed(
            &ix,
            &[
                ctx.accounts.payer.to_account_info(),
                ctx.accounts.nullifier.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
            &[signer_seeds],
        )?;

        // Write Anchor discriminator so the account is recognized as NullifierState.
        use anchor_lang::Discriminator;
        let mut data = ctx.accounts.nullifier.try_borrow_mut_data()?;
        data[..8].copy_from_slice(&crate::state::NullifierState::discriminator());
    } else {
        // Already exists → double-spend
        return err!(TornadoError::NullifierSpent);
    }

    // 4) (Your Groth16 verification should guard correctness before this point.)
    //    If you want, validate that `_recipient_pubkey == ctx.accounts.recipient.key()`.

    // 5) Transfer lamports from VAULT PDA to recipient.
    //    If you store denomination in `config`, replace WITHDRAW_LAMPORTS with that value.
    if WITHDRAW_LAMPORTS > 0 {
        let (vault_key, vbump) =
            Pubkey::find_program_address(&[VAULT_SEED], ctx.program_id);
        require_keys_eq!(
            vault_key,
            ctx.accounts.vault.key(),
            TornadoError::SeedsMismatch
        );

        let signer_vault: &[&[&[u8]]] = &[&[VAULT_SEED, &[vbump]]];
        let cpi = CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.recipient.to_account_info(),
            },
            signer_vault,
        );
        system_program::transfer(cpi, WITHDRAW_LAMPORTS)?;
    }

    Ok(())
}
