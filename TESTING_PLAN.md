# Tornado Cash Testing Plan - Post Deployment

## 🎯 Overview
Comprehensive testing plan for the deployed Tornado Cash privacy mixer on Solana with custom merkle tree implementation.

**Program ID**: `wFafLjoy9oEs8jqWC65kDMB4MdpBCoT5imbqsddqFJJ`

## 🏗️ Testing Architecture

### 1. **Unit Testing** (Isolated Component Testing)
- **Merkle Tree Operations**
  - Test poseidon hash function with known inputs/outputs
  - Test merkle tree insertion and root calculation
  - Test historical root tracking (last 100 roots)
  - Test nullifier set operations (add/check duplicates)
  
- **ZK Circuit Testing**
  - Verify circuit compilation artifacts are valid
  - Test proof generation with valid inputs
  - Test proof verification with valid/invalid proofs
  - Test edge cases (boundary values, zero inputs)

### 2. **Integration Testing** (End-to-End Flows)
- **Deposit Flow Testing**
  - Initialize pool with verification key
  - Deposit 0.1 SOL with commitment
  - Verify merkle tree state updates
  - Verify event emission
  
- **Withdrawal Flow Testing**
  - Generate valid ZK proof off-chain
  - Submit withdrawal with proof
  - Verify nullifier tracking
  - Verify fund transfer to recipient

### 3. **Security Testing** (Attack Scenarios)
- **Double Spending Prevention**
  - Attempt to use same nullifier twice
  - Verify nullifier set prevents reuse
  
- **Invalid Proof Rejection**
  - Submit invalid ZK proofs
  - Submit proofs with wrong public inputs
  - Submit proofs with invalid merkle roots
  
- **Access Control Testing**
  - Test unauthorized operations
  - Test invalid recipient addresses

## 🧪 Detailed Test Cases

### Phase 1: Circuit Validation
```bash
# Test circuit compilation and proof generation
cd circuits/
node test/circuit_test.js
node test/parameter_verification.js
```

**Expected Results:**
- ✅ Circuit compiles without errors
- ✅ Proof generation succeeds with valid inputs
- ✅ Proof verification passes with correct public inputs
- ✅ Verification key matches deployed program

### Phase 2: Program Initialization
```javascript
// Test program initialization
const initTx = await program.methods
  .initialize(
    new anchor.BN(100_000_000), // 0.1 SOL in lamports
    verificationKey
  )
  .accounts({
    payer: wallet.publicKey,
    tornadoPool: tornadoPoolPda,
    merkleTree: merkleTreePda,
    nullifierSet: nullifierSetPda,
    systemProgram: SystemProgram.programId,
  })
  .rpc();
```

**Expected Results:**
- ✅ Program initializes successfully
- ✅ Tornado pool account created with correct parameters
- ✅ Merkle tree account initialized with zero root
- ✅ Nullifier set account created empty

### Phase 3: Deposit Testing
```javascript
// Generate commitment
const secret = crypto.randomBytes(32);
const nullifier = crypto.randomBytes(32);
const commitment = poseidon([secret, nullifier]);

// Test deposit
const depositTx = await program.methods
  .deposit(Array.from(commitment))
  .accounts({
    depositor: wallet.publicKey,
    tornadoPool: tornadoPoolPda,
    merkleTree: merkleTreePda,
    systemProgram: SystemProgram.programId,
  })
  .rpc();
```

**Expected Results:**
- ✅ Deposit succeeds with 0.1 SOL transfer
- ✅ Commitment added to merkle tree
- ✅ Tree root updated correctly
- ✅ Deposit event emitted with correct data
- ✅ Deposit count incremented

### Phase 4: Proof Generation
```javascript
// Generate merkle proof for withdrawal
const leafIndex = 0; // First deposit
const merkleProof = generateMerkleProof(commitment, leafIndex);
const pathIndices = generatePathIndices(leafIndex);

// Generate ZK proof
const input = {
  root: merkleTree.root,
  nullifierHash: poseidon([nullifier]),
  recipient: recipientPubkey.toBytes(),
  relayer: [0, 0], // No relayer
  fee: 0,
  secret: secret,
  nullifier: nullifier,
  pathElements: merkleProof,
  pathIndices: pathIndices
};

const { proof, publicSignals } = await snarkjs.groth16.fullProve(
  input,
  "circuits/withdraw.wasm",
  "circuits/withdraw_0000.zkey"
);
```

**Expected Results:**
- ✅ Merkle proof generation succeeds
- ✅ ZK proof generation completes without errors
- ✅ Public signals match expected format (7 elements)
- ✅ Proof verification passes locally

### Phase 5: Withdrawal Testing
```javascript
// Test withdrawal with valid proof
const withdrawTx = await program.methods
  .withdraw(
    Array.from(proof.pi_a),
    Array.from(proof.pi_b),
    Array.from(proof.pi_c),
    {
      root: Array.from(publicSignals[0]),
      nullifierHash: Array.from(publicSignals[1]),
      recipient1: Array.from(publicSignals[2]),
      recipient2: Array.from(publicSignals[3]),
      relayer1: Array.from(publicSignals[4]),
      relayer2: Array.from(publicSignals[5]),
      fee: Array.from(publicSignals[6]),
    },
    merkleProof,
    pathIndices
  )
  .accounts({
    tornadoPool: tornadoPoolPda,
    merkleTree: merkleTreePda,
    nullifierSet: nullifierSetPda,
    recipient: recipientPubkey,
    systemProgram: SystemProgram.programId,
  })
  .rpc();
```

**Expected Results:**
- ✅ Withdrawal succeeds with valid proof
- ✅ 0.1 SOL transferred to recipient
- ✅ Nullifier added to nullifier set
- ✅ Withdrawal event emitted

## 🔒 Security Test Cases

### Test Case 1: Double Spending Prevention
```javascript
// Attempt to withdraw twice with same nullifier
try {
  await program.methods.withdraw(/* same proof */).rpc();
  throw new Error("Should have failed");
} catch (error) {
  assert(error.message.includes("NullifierAlreadyUsed"));
}
```

### Test Case 2: Invalid Proof Rejection
```javascript
// Test with invalid proof
const invalidProof = { pi_a: [0, 0], pi_b: [0, 0], pi_c: [0, 0] };
try {
  await program.methods.withdraw(invalidProof, /* ... */).rpc();
  throw new Error("Should have failed");
} catch (error) {
  assert(error.message.includes("InvalidProof"));
}
```

### Test Case 3: Wrong Recipient
```javascript
// Test with mismatched recipient
const wrongRecipient = Keypair.generate().publicKey;
try {
  await program.methods.withdraw(/* valid proof but wrong recipient */).rpc();
  throw new Error("Should have failed");
} catch (error) {
  assert(error.message.includes("InvalidRecipient"));
}
```

## 📊 Performance Testing

### Load Testing
- **Multiple Deposits**: Test 10+ sequential deposits
- **Concurrent Operations**: Test simultaneous deposits/withdrawals
- **Tree Depth Limits**: Test approaching 2^20 leaf limit
- **Historical Root Limits**: Test 100+ root history

### Gas/Compute Unit Analysis
- Measure compute units for each operation
- Optimize for Solana's compute unit limits
- Test with maximum-sized transactions

## 🛠️ Testing Tools & Setup

### Required Dependencies
```json
{
  "@coral-xyz/anchor": "^0.31.1",
  "@solana/web3.js": "^1.87.6",
  "snarkjs": "^0.7.0",
  "circomlib": "^2.0.5",
  "chai": "^4.3.7",
  "mocha": "^10.2.0"
}
```

### Environment Setup
```bash
# Install dependencies
npm install

# Build circuits (if needed)
cd circuits && ./compile.sh

# Run tests
npm test
```

## 📋 Test Execution Checklist

### Pre-Testing Setup
- [ ] Verify program deployed at correct address
- [ ] Verify circuit artifacts are present and valid
- [ ] Set up test environment with sufficient SOL
- [ ] Configure RPC endpoint (devnet/mainnet)

### Phase 1: Circuit Tests
- [ ] Circuit compilation test
- [ ] Proof generation test
- [ ] Proof verification test
- [ ] Parameter compatibility test

### Phase 2: Program Tests
- [ ] Program initialization test
- [ ] Deposit functionality test
- [ ] Withdrawal functionality test
- [ ] Event emission test

### Phase 3: Security Tests
- [ ] Double spending prevention test
- [ ] Invalid proof rejection test
- [ ] Access control test
- [ ] Edge case handling test

### Phase 4: Integration Tests
- [ ] End-to-end deposit-withdrawal flow
- [ ] Multiple user scenario
- [ ] Historical root validation
- [ ] Nullifier set management

## 🎯 Success Criteria

### Functional Requirements
- ✅ All deposits succeed and update merkle tree correctly
- ✅ All valid withdrawals succeed and transfer funds
- ✅ All invalid operations are properly rejected
- ✅ ZK proofs verify correctly on-chain

### Security Requirements
- ✅ Double spending is prevented
- ✅ Invalid proofs are rejected
- ✅ Nullifier uniqueness is enforced
- ✅ Access controls work properly

### Performance Requirements
- ✅ Operations complete within compute unit limits
- ✅ Tree operations scale to expected load
- ✅ Historical root tracking works efficiently

## 🚨 Risk Mitigation

### Identified Risks
1. **Circuit-Program Mismatch**: Ensure circuit public inputs match program expectations
2. **Poseidon Compatibility**: Verify hash function consistency between circuit and program
3. **Merkle Tree Synchronization**: Ensure off-chain and on-chain tree states match
4. **Nullifier Management**: Prevent nullifier set overflow or corruption

### Mitigation Strategies
- Comprehensive integration testing
- Cross-validation between circuit and program
- Monitoring and alerting for anomalies
- Gradual rollout with small amounts first

## 📈 Monitoring & Metrics

### Key Metrics to Track
- Deposit success rate
- Withdrawal success rate
- Average transaction time
- Compute unit usage
- Error rates by type

### Alerting Thresholds
- Transaction failure rate > 1%
- Compute unit usage > 90% of limit
- Nullifier collision attempts
- Invalid proof submission rate

---

**Next Steps**: Execute this testing plan systematically, starting with Phase 1 circuit validation and progressing through each phase. Document all results and any issues discovered for resolution.
