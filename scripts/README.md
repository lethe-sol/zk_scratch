# Tornado Mixer Testing Scripts

This folder contains TypeScript scripts for testing the deployed Tornado Mixer program.

## Prerequisites

1. Make sure you have Solana CLI installed and configured:
   ```bash
   solana config get
   ```

2. Ensure you have devnet SOL in your wallet:
   ```bash
   solana balance --url devnet
   ```

3. Install dependencies (run from project root):
   ```bash
   npm install
   # or
   yarn install
   ```

## Scripts

### init.ts
Initializes the Tornado Mixer program by creating the necessary PDAs:
- Vault PDA (holds deposited SOL)
- Merkle Tree PDA (stores commitment tree)
- Config PDA (stores program configuration)

**Usage:**
```bash
# From project root
npx ts-node scripts/init.ts
```

**Configuration:**
- Max Depth: 20 (supports ~1M deposits)
- Max Buffer Size: 64 (batching operations)
- Network: Devnet
- Program ID: `2xBPdkCzfwFdc6khqbvaAvYxWcKMRaueXeVyaLRoWDrN`

## Program Details

The deployed program creates three main PDAs:
- **Vault**: `["vault"]` - Holds pooled SOL for withdrawals
- **Merkle Tree**: `["tree"]` - Compressed merkle tree for commitments  
- **Config**: `["config"]` - Program configuration storage

Each deposit is 0.1 SOL (100,000,000 lamports).
