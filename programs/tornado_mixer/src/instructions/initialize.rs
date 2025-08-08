use anchor_lang::prelude::*;
use crate::state::MixerConfig;

#[derive(Accounts)]
#[instruction(max_depth: u32, max_buffer_size: u32)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// Vault PDA (authority of the tree, holds the pool lamports)
    #[account(
        init,
        seeds = [b"vault"],
        bump,
        payer = payer,
        space = 8 // discriminator only; we don't store data in it
    )]
    pub vault: UncheckedAccount<'info>,

    /// Merkle tree PDA (created in handler with dynamic size)
    /// CHECK: Created with system_instruction::create_account; owned by this program.
    #[account(
        mut,
        seeds = [b"tree"],
        bump
    )]
    pub merkle_tree: UncheckedAccount<'info>,

    /// Config PDA storing the tree pubkey
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
