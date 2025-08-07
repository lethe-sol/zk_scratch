# Tornado Solana

A privacy-preserving SOL mixer built on Solana using ZK proofs and account compression.

## Overview

This Anchor program implements a Tornado Cash-style mixer that allows users to:
- Deposit exactly 0.1 SOL with a commitment hash
- Withdraw anonymously using ZK proofs to prove ownership without revealing which deposit

## Architecture

- **SPL Account Compression**: Uses compressed merkle trees for efficient storage of commitments
- **Light Protocol Groth16 Verifier**: Verifies ZK proofs on-chain using Solana's altbn254 syscalls
- **Nullifier System**: Prevents double-spending using PDA-based nullifier markers

## Program Structure

### State Accounts
- `TornadoState`: Main program state with authority, merkle tree reference, deposit count, and verifying key
- `NullifierMarker`: Small PDA accounts to track spent nullifiers

### Instructions
- `initialize_tree`: Bootstrap the compressed merkle tree (depth 20, supports 1M deposits)
- `deposit`: Lock 0.1 SOL and add commitment to merkle tree
- `withdraw`: Prove ownership and withdraw funds anonymously

### Integration Points
- **SPL Account Compression**: All merkle tree operations use CPI calls
- **Light Protocol Groth16**: ZK proof verification via CPI
- **Circuit Compatibility**: Public inputs match the existing circuit format

## Circuit Integration

The program expects 7 public inputs from the ZK circuit:
1. `root`: Merkle tree root
2. `nullifierHash`: Unique nullifier to prevent double-spending
3. `recipient_1`: First half of recipient pubkey
4. `recipient_2`: Second half of recipient pubkey  
5. `relayer_1`: First half of relayer pubkey (for fee payments)
6. `relayer_2`: Second half of relayer pubkey
7. `fee`: Fee amount in lamports

## Security Features

- Fixed deposit amount (0.1 SOL) prevents amount-based linking
- Nullifier system prevents double-spending
- ZK proofs ensure only valid withdrawals
- Account compression reduces on-chain storage costs

## Building and Deployment

```bash
# Build the program
anchor build

# Deploy to devnet
anchor deploy --provider.cluster devnet

# Run tests
anchor test
```

## Configuration

Update `Anchor.toml` with the correct program IDs:
- Tornado Solana program ID (after deployment)
- SPL Account Compression program ID: `cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK`
- Light Protocol Groth16 verifier program ID

## Dependencies

- Anchor 0.31.1
- SPL Account Compression 0.3.0
- Light Protocol Groth16 verifier
