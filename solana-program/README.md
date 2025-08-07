# Tornado Cash Style Mixer on Solana

A privacy-preserving mixer implementation on Solana using zero-knowledge proofs, built with Anchor framework and integrating with Light Protocol's Groth16 verifier and Solana's account compression program.

## Architecture Overview

This Anchor program implements a tornado cash style mixer with the following key components:

### Account Structures

- **VaultState**: Stores configuration including merkle tree address, deposit amount, and recent roots buffer
- **NullifierBitmap**: Efficient bitmap storage for spent nullifiers (supports ~1M nullifiers)
- **Vault PDA**: Holds pooled SOL funds for deposits/withdrawals

### Instructions

1. **Initialize**: Sets up the mixer with merkle tree and deposit amount
2. **Deposit**: Accepts SOL deposits and appends commitments to merkle tree
3. **Withdraw**: Verifies zero-knowledge proofs and transfers SOL to recipients

### Key Features

- **Bitmap Nullifier Storage**: Uses 16384 * 64 bit bitmap for constant space per withdrawal
- **Recent Roots Buffer**: Ring buffer of 100 recent roots to handle withdrawal lag
- **Account Compression Integration**: Uses official Solana program `compr6CUsB5m2jS4Y3831ztGSTnDpnKJTKS95d64XVq`
- **On-chain Proof Verification**: Direct integration with groth16-solana crate
- **Fee-free Operations**: No relayer fees (can be added later)

## Integration Details

### Account Compression
- Uses CPI calls to append commitments as leaves to the merkle tree
- Leverages Solana's compressed account program for efficient storage
- Supports 20-level merkle trees (1M+ deposits)

### Zero-Knowledge Proofs
- Integrates groth16-solana crate directly for on-chain verification
- Compatible with existing circom circuits in `/circuits` directory
- Public inputs: root, nullifierHash, recipient_1, recipient_2, relayer_1, relayer_2, fee

### Nullifier Management
- Efficient bitmap-based nullifier tracking prevents double-spending
- Constant space complexity regardless of number of withdrawals
- Supports up to ~1M unique nullifiers

### Root Management
- Maintains ring buffer of recent valid roots
- Allows withdrawals against any recent root (handles network lag)
- Configurable buffer size (currently 100 roots)

## Program Constants

- **Deposit Amount**: 0.1 SOL (100,000,000 lamports)
- **Merkle Tree Levels**: 20 (supports 1,048,576 deposits)
- **Recent Roots Buffer**: 100 entries
- **Nullifier Bitmap Size**: 16384 * 64 bits (~1M nullifiers)

## Account Seeds

- Vault State: `["state"]`
- Nullifier Bitmap: `["nullifier"]`
- Vault PDA: `["vault"]`

## Dependencies

- `anchor-lang`: 0.29.0
- `anchor-spl`: 0.29.0
- `groth16-solana`: Latest from Light Protocol
- `spl-account-compression`: 0.3.0 with CPI features
- `spl-concurrent-merkle-tree`: 0.2.0

## Circuit Compatibility

This program is designed to work with the circom circuits in `/circuits`:
- `withdraw.circom`: Main withdrawal circuit
- `merkleTree.circom`: Merkle tree inclusion proofs
- `poseidon.circom`: Hash function implementation

The public input format matches the circuit expectations:
1. Root (32 bytes)
2. Nullifier hash (32 bytes)
3. Recipient address (split into two 16-byte chunks)
4. Relayer address (split into two 16-byte chunks) - currently zero
5. Fee (32 bytes) - currently zero

## Security Considerations

- **Verifying Key**: Currently returns an error placeholder - must be replaced with actual trusted setup key
- **Root Validation**: Only accepts roots from the recent roots buffer
- **Nullifier Uniqueness**: Bitmap prevents double-spending attacks
- **Proof Verification**: Uses groth16-solana for cryptographic proof validation

## Development Notes

- All anchor build and deployment handled by user
- No Solana CLI tools required in this environment
- Compatible with Light Protocol's groth16 verifier
- Designed for mainnet deployment with program ID: `Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS`

## Next Steps

1. Replace verifying key placeholder with actual trusted setup key
2. Test with real circom circuit proofs
3. Add relayer fee support (optional)
4. Deploy to devnet/mainnet
5. Build frontend for proof generation and interaction
