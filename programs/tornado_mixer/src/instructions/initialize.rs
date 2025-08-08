use anchor_lang::prelude::*;
use crate::state::MixerConfig;

#[derive(Accounts)]
#[instruction(max_depth: u32, max_buffer_size: u32)]
pub struct Initialize<'info> {
    // Merkle tree account (to store the concurrent Merkle tree state)
    #[account(
        init, 
        space = 8 + spl_account_compression::state::CONCURRENT_MERKLE_TREE_HEADER_SIZE_V1 + 
                spl_account_compression::state::get_tree_data_size(max_depth, max_buffer_size, 0).unwrap(), 
        payer = payer, 
        owner = ACCOUNT_COMPRESSION_ID
    )]
    pub merkle_tree: UncheckedAccount<'info>,
    // Vault PDA to hold pooled funds and act as tree authority
    #[account(
        init, 
        seeds = [b"vault"], 
        bump, 
        payer = payer, 
        space = 0, 
        owner = program_id
    )]
    pub vault: UncheckedAccount<'info>,
    // Config PDA to store tree pubkey
    #[account(
        init, 
        seeds = [b"config"], 
        bump, 
        payer = payer, 
        space = 8 + 32, 
        owner = program_id
    )]
    pub config: Account<'info, MixerConfig>,
    /// CHECK: The Address of the SPL Account Compression program (for CPI)
    #[account(address = ACCOUNT_COMPRESSION_ID)]
    pub compression_program: UncheckedAccount<'info>,
    /// CHECK: The Address of the Noop program (for CPI logging)
    #[account(address = NOOP_PROGRAM_ID)]
    pub noop_program: UncheckedAccount<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
    // Rent sysvar is implicitly required by Anchor for init (no need to declare explicitly in Anchor 0.31+)
}
