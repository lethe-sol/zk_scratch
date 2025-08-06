# Tornado Cash Solana Program

A privacy-preserving protocol on Solana using Light Protocol's account compression system for anonymous deposits and withdrawals.

## Overview

This Anchor program implements a Tornado Cash-style mixer that allows users to:
1. **Deposit** fixed amounts of SOL and receive a commitment
2. **Withdraw** to any recipient address using zero-knowledge proofs
3. **Maintain privacy** through Light Protocol's compressed Merkle trees

## Architecture

### Core Components

- **TornadoPool**: Main program state containing verification key and Light Protocol references
- **Deposit Instruction**: Uses Light Protocol's `insert_into_queues` to add commitments
- **Withdraw Instruction**: Uses Light Protocol's `nullify_leaves` with ZK proof verification
- **ZK Circuits**: Compatible with Light Protocol's Poseidon hash and Groth16 verifier

### Light Protocol Integration

**Deposits:**
- Calls `light_account_compression::cpi::insert_into_queues`
- Adds commitment hashes to compressed Merkle trees
- Required accounts: `authority`, `registered_program_pda`, `log_wrapper`, `merkle_tree`

**Withdrawals:**
- Calls `light_account_compression::cpi::nullify_leaves`
- Marks leaves as spent to prevent double-spending
- Required accounts: `authority`, `registered_program_pda`, `log_wrapper`, `merkle_tree`, `nullifier_queue`
- Parameters: `change_log_indices`, `leaves_queue_indices`, `leaf_indices`, `proofs`

## Program Instructions

### Initialize
```rust
pub fn initialize(
    ctx: Context<Initialize>,
    deposit_amount: u64,
    verification_key: Groth16VerifyingKey,
) -> Result<()>
```

### Deposit
```rust
pub fn deposit(
    ctx: Context<Deposit>,
    commitment: [u8; 32],
) -> Result<()>
```

### Withdraw
```rust
pub fn withdraw(
    ctx: Context<Withdraw>,
    proof: Groth16Proof,
    public_inputs: WithdrawPublicInputs,
    change_log_indices: Vec<u64>,
    leaves_queue_indices: Vec<u16>,
    leaf_indices: Vec<u64>,
    proofs: Vec<Vec<[u8; 32]>>,
) -> Result<()>
```

## ZK Proof Public Inputs

The withdraw instruction expects 7 public inputs (32 bytes each):
1. `root`: Current Merkle tree root
2. `nullifier_hash`: Hash of nullifier (prevents double-spend)
3. `recipient_1`: First half of recipient Solana pubkey
4. `recipient_2`: Second half of recipient Solana pubkey
5. `relayer_1`: First half of relayer pubkey (future use)
6. `relayer_2`: Second half of relayer pubkey (future use)
7. `fee`: Relayer fee (currently 0)

## Building and Testing

```bash
# Build the program
anchor build

# Run tests
anchor test

# Deploy to devnet
anchor deploy --provider.cluster devnet
```

## Dependencies

- **anchor-lang**: Solana program framework
- **light-account-compression**: Light Protocol's account compression with CPI support
- **groth16-solana**: ZK proof verification
- **light-poseidon**: Poseidon hash function compatible with circuits

## Security Features

- **ZK Proof Verification**: Uses Light Protocol's Groth16 verifier
- **Nullifier Management**: Light Protocol's nullifier queue prevents double-spending
- **Commitment Scheme**: Poseidon hash-based commitments for privacy
- **Fixed Deposits**: All deposits are the same amount to enhance anonymity

## Integration with Circuits

The program embeds the verification key from the ZK circuits and uses Light Protocol's Groth16 verifier to validate proofs. The circuits must generate proofs compatible with:
- BN254 elliptic curve
- Light Protocol's Poseidon parameters
- 7 public inputs as field elements

## Client-Side Integration

Clients need to:
1. Generate commitments using Poseidon hash
2. Query Light Protocol's indexer for Merkle tree state
3. Generate ZK proofs using the circuits
4. Provide nullify_leaves parameters for withdrawals

## Notes

- This implementation uses placeholder verification keys for development
- In production, replace with actual verification keys from trusted setup
- Light Protocol handles nullifier tracking and double-spend prevention
- Solana pubkeys are split into two 16-byte field elements for BN254 compatibility
