# Tornado Cash on Solana - Implementation Guide

This repository contains the complete implementation guide for building a Tornado Cash-style mixer on Solana using Light Protocol's ZK infrastructure.

## Project Overview

**Goal**: Create a privacy-preserving SOL mixer where users can deposit fixed amounts and withdraw to different addresses with full unlinkability.

**Architecture**: 
- Fixed 0.1 SOL deposits
- ZK proofs for anonymous withdrawals  
- Light Protocol's Groth16 verifier for on-chain verification
- Poseidon hash for Merkle trees and commitments
- No FHE (client-side only operations)

**Timeline**: 3-4 weeks with multiple developers working in parallel

## Repository Structure

```
zk_scratch/
├── circuits/           # ZK circuits (modified from Tornado Cash)
├── solana-program/     # Anchor program for deposits/withdrawals
├── frontend/          # React app for user interface
├── ceremony/          # Trusted setup ceremony scripts
├── tests/            # Integration tests
└── docs/             # Additional documentation
```

## Implementation Phases

### Phase 1: Circuit Development (Week 1)
- [circuits/README.md](./circuits/README.md) - Circuit modification guide
- Replace Pedersen/MiMC with Light Protocol Poseidon
- Test circuit compilation and constraint optimization

### Phase 2: Trusted Setup Ceremony (Week 2) 
- [ceremony/README.md](./ceremony/README.md) - MPC ceremony guide
- Coordinate multi-party computation
- Generate proving/verifying keys

### Phase 3: Solana Program (Week 2-3)
- [solana-program/README.md](./solana-program/README.md) - Program development guide
- Implement Merkle tree with Poseidon hashing
- Integrate Light Protocol Groth16 verifier

### Phase 4: Frontend Integration (Week 3-4)
- [frontend/README.md](./frontend/README.md) - Frontend development guide
- Browser-based proof generation
- User interface for deposits/withdrawals

## Quick Start

1. **Set up development environment**:
   ```bash
   # Install dependencies
   npm install -g @coral-xyz/anchor-cli
   npm install -g circom snarkjs
   
   # Clone and setup
   git clone https://github.com/lethe-sol/zk_scratch.git
   cd zk_scratch
   ```

2. **Choose your component**:
   - **Circuits**: Start with `circuits/README.md`
   - **Solana Program**: Start with `solana-program/README.md` 
   - **Frontend**: Start with `frontend/README.md`
   - **Ceremony**: Start with `ceremony/README.md`

3. **Follow the detailed guides** in each directory

## Architecture Flow

### User Deposit Flow
1. User generates random nullifier + secret client-side
2. Computes commitment = Poseidon(nullifier, secret)
3. Sends deposit transaction with commitment to Solana
4. Program adds commitment to Merkle tree
5. User receives note string containing secrets + deposit index

### User Withdrawal Flow  
1. User pastes note string + recipient address
2. Client generates Merkle proof for commitment
3. Client generates ZK proof of valid nullifier without revealing which deposit
4. Sends withdrawal transaction with ZK proof to Solana
5. Program verifies proof and transfers SOL to recipient
6. Nullifier marked as used to prevent double-spending

## Security Model

**Privacy Guarantees**:
- Deposits and withdrawals are cryptographically unlinkable
- Fixed amounts prevent amount-based correlation
- ZK proofs hide which specific deposit was withdrawn

**Security Assumptions**:
- At least 1 honest participant in trusted setup ceremony
- Light Protocol's Groth16 verifier is secure
- Poseidon hash function is collision-resistant

## Development Coordination

**Branch Strategy**:
- `main` - Main documentation and project coordination
- `circuits/*` - Circuit development branches
- `solana/*` - Solana program development branches  
- `frontend/*` - Frontend development branches
- `ceremony/*` - Trusted setup ceremony branches

**Communication**:
- Use GitHub issues for task coordination
- Each major component has detailed README with specific tasks
- Integration points clearly documented between components

## Next Steps

1. **Read the component-specific READMEs** for detailed implementation guides
2. **Choose your development track** based on your expertise
3. **Follow the step-by-step instructions** in each component directory
4. **Coordinate integration points** using the documented interfaces

Let's build privacy-preserving DeFi on Solana! 🚀
