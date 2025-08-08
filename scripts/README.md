# Tornado Mixer Testing Scripts

This folder contains TypeScript scripts for testing the deployed Tornado Mixer program.

## Prerequisites

1. Make sure you have Solana CLI installed and configured:
   ```bash
   solana config get
   ```

2. Set up your Anchor wallet environment:
   ```bash
   export ANCHOR_WALLET=~/.config/solana/id.json
   # or point to your specific wallet file
   ```

3. Ensure you have devnet SOL in your wallet:
   ```bash
   solana balance --url devnet
   ```

4. Install dependencies (run from project root):
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

### deposit.ts
Makes a deposit to the Tornado Mixer by:
- Generating random nullifier and secret
- Computing commitment hash
- Sending 0.1 SOL to the vault
- Adding commitment to the merkle tree
- Saving deposit info for later withdrawal

**Usage:**
```bash
# From project root
npx ts-node scripts/deposit.ts
```

**Important Notes:**
- Each deposit is exactly 0.1 SOL (100,000,000 lamports)
- Generates a deposit info file with nullifier/secret for withdrawal
- Current implementation uses simple hash for testing (not production Poseidon)
- Merkle tree depth mismatch: on-chain (6) vs circuits (20) - will need resolution for withdrawals

### withdraw.ts
Tests withdrawal functionality using mock proofs (since circuits are for depth 20 but tree is depth 6):
- Loads the most recent deposit file
- Generates mock Groth16 proof and merkle root
- Tests withdrawal instruction parameter encoding
- Validates nullifier PDA creation
- Expected to fail with "InvalidProof" but confirms instruction structure works

**Usage:**
```bash
# From project root (requires prior deposit)
npx ts-node scripts/withdraw.ts
```

**Important Notes:**
- Requires a deposit file from previous `deposit.ts` run
- Uses mock proofs since circuits expect depth 20 but tree is depth 6
- Tests instruction flow and parameter validation
- Will fail with "InvalidProof" error (expected behavior)
- Saves withdrawal attempt info for debugging

**Expected Output:**
- ✅ Parameter encoding validation successful
- ⚠️ "InvalidProof" error (expected with mock proof)
- 💾 Withdrawal attempt info saved to file

**Configuration:**
- Max Depth: 6 (supports 64 deposits)
- Max Buffer Size: 16 (batching operations)
- Network: Devnet
- Program ID: `2xBPdkCzfwFdc6khqbvaAvYxWcKMRaueXeVyaLRoWDrN`

## Program Details

The deployed program creates three main PDAs:
- **Vault**: `["vault"]` - Holds pooled SOL for withdrawals
- **Merkle Tree**: `["tree"]` - Compressed merkle tree for commitments  
- **Config**: `["config"]` - Program configuration storage

Each deposit is 0.1 SOL (100,000,000 lamports).
