# ZK Circuits - Implementation Guide

## Overview

This directory contains the ZK circuits for the Tornado Cash mixer, modified to use Light Protocol's Poseidon hash instead of Pedersen/MiMC.

## Circuit Architecture

### Files to Create
```
circuits/
├── withdraw.circom          # Main withdrawal circuit
├── merkleTree.circom       # Merkle tree verification
├── poseidon.circom         # Light Protocol Poseidon wrapper
├── package.json            # Dependencies
├── compile.sh              # Compilation script
├── test/                   # Circuit tests
└── build/                  # Compiled outputs
```

## Step-by-Step Implementation

### Step 1: Environment Setup (Day 1)

**Install Dependencies**:
```bash
cd circuits/
npm init -y
npm install circom snarkjs
npm install @lightprotocol/light-poseidon
```

**Create compilation script**:
```bash
# circuits/compile.sh
#!/bin/bash
set -e

echo "Compiling withdraw circuit..."
circom withdraw.circom --r1cs --wasm --sym --c --O1

echo "Compiling merkleTree circuit..."  
circom merkleTree.circom --r1cs --wasm --sym --c --O1

echo "Checking constraint counts..."
snarkjs r1cs info withdraw.r1cs
snarkjs r1cs info merkleTree.r1cs

echo "Compilation complete!"
```

### Step 2: Poseidon Integration (Day 1-2)

**Create Poseidon wrapper** (`poseidon.circom`):
```circom
pragma circom 2.0.0;

// Light Protocol Poseidon hash function
// Must match exact parameters from light-poseidon Rust implementation
template Poseidon(nInputs) {
    signal input inputs[nInputs];
    signal output out;
    
    // Use Light Protocol's Poseidon parameters
    // t = nInputs + 1 (state size)
    // nRoundsF = 8 (full rounds)  
    // nRoundsP = 57 (partial rounds for t=3)
    component hasher = PoseidonEx(nInputs, 1);
    
    for (var i = 0; i < nInputs; i++) {
        hasher.inputs[i] <== inputs[i];
    }
    
    out <== hasher.out[0];
}

// Import Light Protocol's Poseidon implementation
// This must match the exact parameters used in their Rust code
include "node_modules/@lightprotocol/light-poseidon/circuits/poseidon.circom";
```

### Step 3: Merkle Tree Circuit (Day 2)

**Create merkleTree.circom**:
```circom
pragma circom 2.0.0;

include "./poseidon.circom";

// Hash two field elements using Poseidon
template HashLeftRight() {
    signal input left;
    signal input right;
    signal output hash;

    component hasher = Poseidon(2);
    hasher.inputs[0] <== left;
    hasher.inputs[1] <== right;
    hash <== hasher.out;
}

// Selector for Merkle tree path
template DualMux() {
    signal input in[2];
    signal input s;
    signal output out[2];

    s * (1 - s) === 0;
    out[0] <== (in[1] - in[0]) * s + in[0];
    out[1] <== (in[0] - in[1]) * s + in[1];
}

// Merkle tree membership proof
template MerkleTreeChecker(levels) {
    signal input leaf;
    signal input root;
    signal input pathElements[levels];
    signal input pathIndices[levels];

    component selectors[levels];
    component hashers[levels];

    for (var i = 0; i < levels; i++) {
        selectors[i] = DualMux();
        selectors[i].in[0] <== i == 0 ? leaf : hashers[i - 1].hash;
        selectors[i].in[1] <== pathElements[i];
        selectors[i].s <== pathIndices[i];

        hashers[i] = HashLeftRight();
        hashers[i].left <== selectors[i].out[0];
        hashers[i].right <== selectors[i].out[1];
    }

    root === hashers[levels - 1].hash;
}
```

### Step 4: Withdrawal Circuit (Day 2-3)

**Create withdraw.circom**:
```circom
pragma circom 2.0.0;

include "./merkleTree.circom";
include "./poseidon.circom";

// Commitment hasher using Poseidon
template CommitmentHasher() {
    signal input nullifier;
    signal input secret;
    signal output commitment;
    signal output nullifierHash;

    component commitmentHasher = Poseidon(2);
    commitmentHasher.inputs[0] <== nullifier;
    commitmentHasher.inputs[1] <== secret;
    commitment <== commitmentHasher.out;

    component nullifierHasher = Poseidon(1);
    nullifierHasher.inputs[0] <== nullifier;
    nullifierHash <== nullifierHasher.out;
}

// Main withdrawal circuit
template Withdraw(levels) {
    // Public inputs (verified on-chain)
    signal input root;
    signal input nullifierHash;
    signal input recipient; // Solana pubkey as field element
    signal input relayer;   // Optional relayer address
    signal input fee;       // Optional relayer fee

    // Private inputs (hidden in proof)
    signal private input nullifier;
    signal private input secret;
    signal private input pathElements[levels];
    signal private input pathIndices[levels];

    // Compute commitment and nullifier hash
    component hasher = CommitmentHasher();
    hasher.nullifier <== nullifier;
    hasher.secret <== secret;

    // Verify nullifier hash matches public input
    nullifierHash === hasher.nullifierHash;

    // Verify commitment is in Merkle tree
    component tree = MerkleTreeChecker(levels);
    tree.leaf <== hasher.commitment;
    tree.root <== root;
    for (var i = 0; i < levels; i++) {
        tree.pathElements[i] <== pathElements[i];
        tree.pathIndices[i] <== pathIndices[i];
    }

    // Add recipient and relayer constraints
    // These are just passed through as public inputs
    signal recipientSquare;
    signal relayerSquare;
    signal feeSquare;
    recipientSquare <== recipient * recipient;
    relayerSquare <== relayer * relayer;
    feeSquare <== fee * fee;
}

// Main component with 20 levels (supports 1M deposits)
component main = Withdraw(20);
```

### Step 5: Testing and Validation (Day 3-4)

**Create test script** (`test/circuit_test.js`):
```javascript
const circomlib = require("circomlib");
const snarkjs = require("snarkjs");
const fs = require("fs");

async function testWithdrawCircuit() {
    // Test inputs
    const nullifier = "123456789";
    const secret = "987654321";
    
    // Compute commitment using same Poseidon as circuit
    const poseidon = await circomlib.buildPoseidon();
    const commitment = poseidon([nullifier, secret]);
    const nullifierHash = poseidon([nullifier]);
    
    // Mock Merkle tree data
    const pathElements = new Array(20).fill("0");
    const pathIndices = new Array(20).fill(0);
    
    const input = {
        root: "12345",
        nullifierHash: nullifierHash.toString(),
        recipient: "67890",
        relayer: "0",
        fee: "0",
        nullifier: nullifier,
        secret: secret,
        pathElements: pathElements,
        pathIndices: pathIndices
    };
    
    console.log("Generating witness...");
    const witness = await snarkjs.wtns.calculate(input, "withdraw.wasm");
    
    console.log("Witness generated successfully!");
    console.log("Circuit test passed ✅");
}

testWithdrawCircuit().catch(console.error);
```

### Step 6: Parameter Coordination (Day 4)

**Verify Poseidon parameters match Light Protocol**:
```javascript
// test/parameter_verification.js
const lightPoseidon = require("@lightprotocol/light-poseidon");

async function verifyParameters() {
    // Get parameters from Light Protocol
    const rustParams = await lightPoseidon.getParameters();
    
    // Compare with our circuit parameters
    console.log("Light Protocol Poseidon Parameters:");
    console.log("t (state size):", rustParams.t);
    console.log("nRoundsF (full rounds):", rustParams.nRoundsF);
    console.log("nRoundsP (partial rounds):", rustParams.nRoundsP);
    
    // Ensure our circuit uses identical parameters
    // This is CRITICAL for compatibility
}

verifyParameters();
```

## Integration Points

### With Solana Program
- **Verifying Key**: Export from trusted setup ceremony
- **Public Input Format**: Must match exactly between circuit and program
- **Field Element Conversion**: Ensure proper BN254 field element handling

### With Frontend
- **Witness Generation**: Provide JavaScript functions for input preparation
- **WASM Integration**: Compiled circuit must work in browser
- **Proof Format**: Groth16 proof format for Light Protocol verifier

## Success Criteria

- [ ] Circuits compile without errors
- [ ] Constraint count < 10,000 (for reasonable proving time)
- [ ] Test proofs verify successfully
- [ ] Parameters match Light Protocol exactly
- [ ] Integration tests pass with mock Solana program

## Common Issues

**Compilation Errors**:
- Check Poseidon parameter compatibility
- Verify all signal constraints are satisfied
- Ensure proper include paths

**Constraint Optimization**:
- Use `--O1` flag for optimization
- Minimize unnecessary signal operations
- Consider constraint count vs security tradeoffs

**Parameter Mismatches**:
- Double-check Light Protocol Poseidon parameters
- Test hash outputs match between Rust and Circom
- Verify field element ranges

## Next Steps

1. **Complete circuit implementation** following this guide
2. **Run comprehensive tests** to verify correctness
3. **Coordinate with ceremony team** for trusted setup
4. **Integrate with Solana program** for end-to-end testing

The circuits are the foundation of the entire system - get these right and everything else follows! 🔧
