# Solana Program - Implementation Guide

## Overview

The Solana program handles deposits, withdrawals, and ZK proof verification using Light Protocol's Groth16 verifier and Poseidon hash functions.

## Program Architecture

### Core Components
```
solana-program/
├── programs/tornado/
│   ├── src/
│   │   ├── lib.rs              # Program entry point
│   │   ├── instructions/       # Deposit/withdraw instructions
│   │   ├── state/             # Account structures
│   │   ├── merkle/            # Merkle tree implementation
│   │   └── errors.rs          # Custom error types
├── tests/                     # Integration tests
├── Anchor.toml               # Anchor configuration
└── package.json              # Dependencies
```

## Step-by-Step Implementation

### Step 1: Project Setup (Day 1)

**Initialize Anchor Project**:
```bash
cd solana-program/
anchor init tornado --no-git
cd tornado

# Add Light Protocol dependencies
cargo add light-groth16-verifier
cargo add light-poseidon
cargo add anchor-lang
cargo add anchor-spl
```

**Configure Anchor.toml**:
```toml
[features]
resolution = true
skip-lint = false

[programs.localnet]
tornado = "TornadoXYZ..." # Will be generated

[registry]
url = "https://api.apr.dev"

[provider]
cluster = "Localnet"
wallet = "~/.config/solana/id.json"

[scripts]
test = "yarn run ts-mocha -p ./tsconfig.json -t 1000000 tests/**/*.ts"
```

### Step 2: State Structures (Day 1-2)

**Create state/mod.rs**:
```rust
use anchor_lang::prelude::*;

#[account]
pub struct TornadoState {
    pub authority: Pubkey,              // Program authority
    pub levels: u8,                     // Merkle tree depth (20)
    pub current_root_index: u8,         // Current root in history
    pub next_index: u32,                // Next available leaf position
    pub filled_subtrees: [[u8; 32]; 20], // Cached subtree roots
    pub roots: [[u8; 32]; 30],          // Root history buffer
    pub nullifier_hashes: Vec<[u8; 32]>, // Used nullifiers
    pub total_deposits: u64,            // Total SOL deposited
    pub deposit_amount: u64,            // Fixed deposit amount (0.1 SOL)
}

impl TornadoState {
    pub const LEN: usize = 8 + // discriminator
        32 + // authority
        1 +  // levels
        1 +  // current_root_index
        4 +  // next_index
        (32 * 20) + // filled_subtrees
        (32 * 30) + // roots
        4 + (32 * 1000) + // nullifier_hashes (max 1000)
        8 +  // total_deposits
        8;   // deposit_amount

    pub fn initialize(&mut self, authority: Pubkey) -> Result<()> {
        self.authority = authority;
        self.levels = 20;
        self.current_root_index = 0;
        self.next_index = 0;
        self.filled_subtrees = [[0u8; 32]; 20];
        self.roots = [[0u8; 32]; 30];
        self.nullifier_hashes = Vec::new();
        self.total_deposits = 0;
        self.deposit_amount = 100_000_000; // 0.1 SOL
        Ok(())
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct DepositEvent {
    pub commitment: [u8; 32],
    pub leaf_index: u32,
    pub timestamp: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct WithdrawEvent {
    pub nullifier_hash: [u8; 32],
    pub recipient: Pubkey,
    pub relayer: Pubkey,
    pub fee: u64,
}
```

### Step 3: Merkle Tree Implementation (Day 2-3)

**Create merkle/mod.rs**:
```rust
use anchor_lang::prelude::*;
use light_poseidon::{Poseidon, PoseidonError};

pub struct MerkleTree;

impl MerkleTree {
    /// Insert commitment into Merkle tree
    pub fn insert(
        state: &mut TornadoState,
        commitment: [u8; 32],
    ) -> Result<u32> {
        let insert_index = state.next_index;
        let mut current_index = insert_index;
        let mut current_hash = commitment;

        // Update tree level by level using Poseidon hash
        for level in 0..state.levels {
            if current_index % 2 == 0 {
                // Left child - store and break
                state.filled_subtrees[level as usize] = current_hash;
                break;
            } else {
                // Right child - hash with left sibling
                let left_sibling = state.filled_subtrees[level as usize];
                current_hash = Self::poseidon_hash_2(&[left_sibling, current_hash])?;
                current_index /= 2;
            }
        }

        // Update root and increment counter
        Self::update_root(state)?;
        state.next_index += 1;

        Ok(insert_index)
    }

    /// Update Merkle tree root
    fn update_root(state: &mut TornadoState) -> Result<()> {
        let mut root = state.filled_subtrees[0];

        // Compute root by hashing up the tree
        for level in 1..state.levels {
            let right_subtree = if level < state.levels - 1 {
                state.filled_subtrees[level as usize]
            } else {
                [0u8; 32] // Empty subtree
            };
            root = Self::poseidon_hash_2(&[root, right_subtree])?;
        }

        // Add to root history
        state.current_root_index = (state.current_root_index + 1) % 30;
        state.roots[state.current_root_index as usize] = root;

        Ok(())
    }

    /// Check if root exists in recent history
    pub fn is_known_root(state: &TornadoState, root: [u8; 32]) -> bool {
        state.roots.contains(&root)
    }

    /// Hash two 32-byte values using Light Protocol's Poseidon
    fn poseidon_hash_2(inputs: &[[u8; 32]]) -> Result<[u8; 32]> {
        // Convert bytes to field elements
        let field_inputs: Vec<_> = inputs
            .iter()
            .map(|bytes| Self::bytes_to_field_element(bytes))
            .collect::<Result<Vec<_>>>()?;

        // Hash using Light Protocol's Poseidon
        let mut poseidon = Poseidon::new();
        let result = poseidon.hash(&field_inputs)
            .map_err(|_| ErrorCode::PoseidonHashError)?;

        // Convert back to bytes
        Self::field_element_to_bytes(&result)
    }

    /// Convert 32 bytes to BN254 field element
    fn bytes_to_field_element(bytes: &[u8; 32]) -> Result<[u8; 32]> {
        let mut result = *bytes;
        // Ensure value < BN254 field modulus by clearing top bits
        result[31] &= 0x1f;
        Ok(result)
    }

    /// Convert field element back to 32 bytes
    fn field_element_to_bytes(field: &[u8; 32]) -> Result<[u8; 32]> {
        Ok(*field)
    }
}
```

### Step 4: Deposit Instruction (Day 3)

**Create instructions/deposit.rs**:
```rust
use anchor_lang::prelude::*;
use crate::state::*;
use crate::merkle::MerkleTree;
use crate::errors::ErrorCode;

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub depositor: Signer<'info>,

    #[account(
        mut,
        seeds = [b"tornado_state"],
        bump,
    )]
    pub tornado_state: Account<'info, TornadoState>,

    pub system_program: Program<'info, System>,
}

pub fn deposit(ctx: Context<Deposit>, commitment: [u8; 32]) -> Result<()> {
    let tornado_state = &mut ctx.accounts.tornado_state;
    let depositor = &ctx.accounts.depositor;

    // Validate commitment is valid field element
    require!(
        is_valid_field_element(&commitment),
        ErrorCode::InvalidCommitment
    );

    // Transfer SOL from depositor to program
    let transfer_ix = anchor_lang::system_program::Transfer {
        from: depositor.to_account_info(),
        to: tornado_state.to_account_info(),
    };
    
    anchor_lang::system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            transfer_ix,
        ),
        tornado_state.deposit_amount,
    )?;

    // Insert commitment into Merkle tree
    let leaf_index = MerkleTree::insert(tornado_state, commitment)?;

    // Update total deposits
    tornado_state.total_deposits += tornado_state.deposit_amount;

    // Emit deposit event
    emit!(DepositEvent {
        commitment,
        leaf_index,
        timestamp: Clock::get()?.unix_timestamp,
    });

    msg!("Deposit successful: commitment={:?}, index={}", commitment, leaf_index);
    Ok(())
}

fn is_valid_field_element(bytes: &[u8; 32]) -> bool {
    // Check if value is less than BN254 field modulus
    // This is a simplified check - in production, use proper field arithmetic
    bytes[31] < 0x20
}
```

### Step 5: Withdrawal Instruction (Day 4-5)

**Create instructions/withdraw.rs**:
```rust
use anchor_lang::prelude::*;
use light_groth16_verifier::{Groth16Verifier, Proof, VerifyingKey};
use crate::state::*;
use crate::merkle::MerkleTree;
use crate::errors::ErrorCode;

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub recipient: SystemAccount<'info>,

    /// CHECK: Relayer can be any account
    #[account(mut)]
    pub relayer: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [b"tornado_state"],
        bump,
    )]
    pub tornado_state: Account<'info, TornadoState>,

    pub system_program: Program<'info, System>,
}

pub fn withdraw(
    ctx: Context<Withdraw>,
    proof: [u8; 256],           // Groth16 proof
    root: [u8; 32],            // Merkle tree root
    nullifier_hash: [u8; 32],  // Nullifier hash
    recipient: Pubkey,         // Withdrawal recipient
    relayer: Pubkey,           // Optional relayer
    fee: u64,                  // Optional relayer fee
) -> Result<()> {
    let tornado_state = &mut ctx.accounts.tornado_state;

    // 1. Verify root is in recent history
    require!(
        MerkleTree::is_known_root(tornado_state, root),
        ErrorCode::UnknownRoot
    );

    // 2. Check nullifier hasn't been used
    require!(
        !tornado_state.nullifier_hashes.contains(&nullifier_hash),
        ErrorCode::NullifierAlreadyUsed
    );

    // 3. Validate fee doesn't exceed deposit amount
    require!(
        fee <= tornado_state.deposit_amount,
        ErrorCode::FeeTooHigh
    );

    // 4. Prepare public inputs for ZK verification
    let public_inputs = [
        field_element_from_bytes(&root)?,
        field_element_from_bytes(&nullifier_hash)?,
        field_element_from_pubkey(&recipient)?,
        field_element_from_pubkey(&relayer)?,
        field_element_from_u64(fee)?,
    ];

    // 5. Verify ZK proof using Light Protocol's verifier
    let verifying_key = load_verifying_key()?;
    let groth16_proof = parse_proof(&proof)?;
    
    let verifier = Groth16Verifier::new(&verifying_key)?;
    require!(
        verifier.verify(&groth16_proof, &public_inputs)?,
        ErrorCode::InvalidProof
    );

    // 6. Mark nullifier as used
    tornado_state.nullifier_hashes.push(nullifier_hash);

    // 7. Calculate withdrawal amount
    let withdraw_amount = tornado_state.deposit_amount - fee;

    // 8. Transfer SOL to recipient
    **tornado_state.to_account_info().try_borrow_mut_lamports()? -= withdraw_amount;
    **ctx.accounts.recipient.to_account_info().try_borrow_mut_lamports()? += withdraw_amount;

    // 9. Pay relayer fee (if any)
    if fee > 0 {
        **tornado_state.to_account_info().try_borrow_mut_lamports()? -= fee;
        **ctx.accounts.relayer.to_account_info().try_borrow_mut_lamports()? += fee;
    }

    // 10. Emit withdrawal event
    emit!(WithdrawEvent {
        nullifier_hash,
        recipient,
        relayer,
        fee,
    });

    msg!("Withdrawal successful: nullifier={:?}, recipient={}", nullifier_hash, recipient);
    Ok(())
}

// Helper functions for ZK proof verification
fn load_verifying_key() -> Result<VerifyingKey> {
    // Load verifying key from ceremony
    // In production, this would be stored in program data
    todo!("Load verifying key from trusted setup ceremony")
}

fn parse_proof(proof_bytes: &[u8; 256]) -> Result<Proof> {
    // Parse Groth16 proof from bytes
    // Format: 3 G1 points (96 bytes) + 1 G2 point (128 bytes) + padding
    todo!("Parse Groth16 proof from byte array")
}

fn field_element_from_bytes(bytes: &[u8; 32]) -> Result<[u8; 32]> {
    let mut result = *bytes;
    result[31] &= 0x1f; // Ensure < BN254 field modulus
    Ok(result)
}

fn field_element_from_pubkey(pubkey: &Pubkey) -> Result<[u8; 32]> {
    field_element_from_bytes(&pubkey.to_bytes())
}

fn field_element_from_u64(value: u64) -> Result<[u8; 32]> {
    let mut bytes = [0u8; 32];
    bytes[24..32].copy_from_slice(&value.to_le_bytes());
    Ok(bytes)
}
```

### Step 6: Error Handling (Day 5)

**Create errors.rs**:
```rust
use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid commitment - not a valid field element")]
    InvalidCommitment,

    #[msg("Unknown Merkle tree root")]
    UnknownRoot,

    #[msg("Nullifier has already been used")]
    NullifierAlreadyUsed,

    #[msg("Invalid ZK proof")]
    InvalidProof,

    #[msg("Fee exceeds deposit amount")]
    FeeTooHigh,

    #[msg("Poseidon hash error")]
    PoseidonHashError,

    #[msg("Merkle tree is full")]
    TreeFull,

    #[msg("Insufficient funds for deposit")]
    InsufficientFunds,

    #[msg("Invalid recipient address")]
    InvalidRecipient,

    #[msg("Program not initialized")]
    NotInitialized,
}
```

### Step 7: Program Entry Point (Day 5)

**Update lib.rs**:
```rust
use anchor_lang::prelude::*;

pub mod instructions;
pub mod state;
pub mod merkle;
pub mod errors;

use instructions::*;
use state::*;
use errors::ErrorCode;

declare_id!("TornadoXYZ..."); // Will be generated by Anchor

#[program]
pub mod tornado {
    use super::*;

    /// Initialize the tornado mixer program
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let tornado_state = &mut ctx.accounts.tornado_state;
        tornado_state.initialize(ctx.accounts.authority.key())?;
        msg!("Tornado mixer initialized");
        Ok(())
    }

    /// Deposit SOL into the mixer
    pub fn deposit(ctx: Context<Deposit>, commitment: [u8; 32]) -> Result<()> {
        instructions::deposit::deposit(ctx, commitment)
    }

    /// Withdraw SOL from the mixer with ZK proof
    pub fn withdraw(
        ctx: Context<Withdraw>,
        proof: [u8; 256],
        root: [u8; 32],
        nullifier_hash: [u8; 32],
        recipient: Pubkey,
        relayer: Pubkey,
        fee: u64,
    ) -> Result<()> {
        instructions::withdraw::withdraw(
            ctx, proof, root, nullifier_hash, recipient, relayer, fee
        )
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = TornadoState::LEN,
        seeds = [b"tornado_state"],
        bump,
    )]
    pub tornado_state: Account<'info, TornadoState>,

    pub system_program: Program<'info, System>,
}
```

### Step 8: Integration Testing (Day 6-7)

**Create tests/tornado.ts**:
```typescript
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Tornado } from "../target/types/tornado";
import { expect } from "chai";

describe("tornado", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Tornado as Program<Tornado>;
  const authority = provider.wallet.publicKey;

  let tornadoState: anchor.web3.PublicKey;

  before(async () => {
    // Derive tornado state PDA
    [tornadoState] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("tornado_state")],
      program.programId
    );
  });

  it("Initializes the program", async () => {
    await program.methods
      .initialize()
      .accounts({
        authority,
        tornadoState,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const state = await program.account.tornadoState.fetch(tornadoState);
    expect(state.authority.toString()).to.equal(authority.toString());
    expect(state.levels).to.equal(20);
    expect(state.nextIndex).to.equal(0);
  });

  it("Accepts deposits", async () => {
    const commitment = Buffer.from("1234567890abcdef".repeat(4), "hex");
    
    await program.methods
      .deposit(Array.from(commitment))
      .accounts({
        depositor: authority,
        tornadoState,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const state = await program.account.tornadoState.fetch(tornadoState);
    expect(state.nextIndex).to.equal(1);
    expect(state.totalDeposits.toString()).to.equal("100000000"); // 0.1 SOL
  });

  it("Rejects invalid withdrawals", async () => {
    const fakeProof = new Array(256).fill(0);
    const fakeRoot = new Array(32).fill(0);
    const fakeNullifier = new Array(32).fill(1);
    const recipient = anchor.web3.Keypair.generate().publicKey;

    try {
      await program.methods
        .withdraw(
          fakeProof,
          fakeRoot,
          fakeNullifier,
          recipient,
          anchor.web3.PublicKey.default,
          0
        )
        .accounts({
          recipient,
          relayer: anchor.web3.PublicKey.default,
          tornadoState,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();
      
      expect.fail("Should have rejected invalid proof");
    } catch (error) {
      expect(error.message).to.include("InvalidProof");
    }
  });
});
```

## Integration Points

### With Circuits Team
- **Verifying Key**: Receive verification_key.json from ceremony
- **Public Input Format**: Must match circuit's public signals exactly
- **Field Element Conversion**: Ensure proper BN254 field handling

### With Frontend Team
- **Program ID**: Provide deployed program address
- **Instruction Format**: Document exact instruction data structures
- **Account Structure**: Provide TypeScript types for accounts

### With Ceremony Team
- **Key Integration**: Integrate verifying key from trusted setup
- **Key Format**: Ensure compatibility with Light Protocol verifier
- **Testing**: Validate keys work with program

## Deployment Process

**Local Testing**:
```bash
# Start local validator
solana-test-validator

# Deploy program
anchor deploy

# Run tests
anchor test
```

**Devnet Deployment**:
```bash
# Configure for devnet
solana config set --url devnet

# Deploy to devnet
anchor deploy --provider.cluster devnet

# Verify deployment
solana program show <PROGRAM_ID>
```

## Success Criteria

- [ ] Program compiles without errors
- [ ] All unit tests pass
- [ ] Integration tests with mock proofs work
- [ ] Light Protocol verifier integration successful
- [ ] Poseidon hash functions work correctly
- [ ] Merkle tree operations are gas-efficient
- [ ] Proper error handling for all edge cases

## Performance Optimization

**Compute Unit Usage**:
- Deposit: ~50,000 CU (mostly Poseidon hashing)
- Withdraw: ~200,000 CU (mostly Groth16 verification)
- Target: Stay under 400,000 CU limit

**Storage Optimization**:
- Use efficient data structures for nullifier tracking
- Consider using compressed accounts for large datasets
- Optimize Merkle tree storage patterns

## Security Considerations

**Access Control**:
- Only program can modify tornado state
- Proper PDA derivation for state accounts
- Validate all user inputs

**Reentrancy Protection**:
- Use Anchor's built-in protections
- Careful ordering of state updates and transfers
- Proper error handling and rollback

**Economic Security**:
- Fixed deposit amounts prevent amount-based attacks
- Fee validation prevents economic exploits
- Proper SOL accounting and balance checks

The Solana program is the heart of the mixer - security and correctness are paramount! 🔒
