use anchor_lang::prelude::*;
use crate::state::MixerConfig;

#[derive(Accounts)]
#[instruction(max_depth: u32, max_buffer_size: u32)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: Vault is a PDA derived by seeds [b"vault"]; we don't read/write any data on it,
    /// it only holds lamports and signs via seeds in handlers.
    #[account(
        init,
        seeds = [b"vault"],
        bump,
        payer = payer,
        space = 8 // discriminator only; no data stored
    )]
    pub vault: UncheckedAccount<'info>,

    /// CHECK: Merkle tree is a PDA derived by [b"tree"]; created and owned by this program.
    /// Size and header are validated in the handler before use; we only write the header
    /// and tree bytes via SPL account-compression wrappers.
    #[account(
        mut,
        seeds = [b"tree"],
        bump
    )]
    pub merkle_tree: UncheckedAccount<'info>,

    #[account(
        init,
        seeds = [b"config"],
        bump,
        payer = payer,
        space = 8 + 32 // discriminator + Pubkey
    )]
    pub config: Account<'info, MixerConfig>,

    pub system_program: Program<'info, System>,
}
