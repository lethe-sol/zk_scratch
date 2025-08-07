use anchor_lang::prelude::*;
use spl_account_compression::{
    program::SplAccountCompression,
    cpi::{accounts::InitEmptyMerkleTree, init_empty_merkle_tree},
    Noop,
};
use crate::state::*;
use crate::errors::*;
use crate::verifying_key::VERIFYINGKEY;

#[derive(Accounts)]
pub struct InitializeTree<'info> {
    #[account(
        init,
        payer = payer,
        space = TornadoState::LEN,
        seeds = [b"tornado_state"],
        bump
    )]
    pub state: Account<'info, TornadoState>,
    
    #[account(mut)]
    pub payer: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"merkle_tree"],
        bump
    )]
    pub merkle_tree: AccountInfo<'info>,
    
    pub system_program: Program<'info, System>,
    pub compression_program: Program<'info, SplAccountCompression>,
    pub log_wrapper: Program<'info, Noop>,
}

pub fn handler(ctx: Context<InitializeTree>) -> Result<()> {
    let state = &mut ctx.accounts.state;
    
    state.authority = ctx.accounts.payer.key();
    state.merkle_tree = ctx.accounts.merkle_tree.key();
    state.deposit_count = 0;
    state.verifying_key_initialized = true;
    
    let cpi_accounts = InitEmptyMerkleTree {
        merkle_tree: ctx.accounts.merkle_tree.to_account_info(),
        authority: state.to_account_info(),
        noop: ctx.accounts.log_wrapper.to_account_info(),
    };
    
    let cpi_program = ctx.accounts.compression_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    
    init_empty_merkle_tree(cpi_ctx, 20, 64)?;
    
    msg!("Tornado Cash merkle tree initialized with depth 20");
    msg!("Verifying key initialized with {} public inputs", VERIFYINGKEY.nr_pubinputs);
    
    Ok(())
}
