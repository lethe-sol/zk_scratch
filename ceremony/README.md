# Trusted Setup Ceremony - Implementation Guide

## Overview

The trusted setup ceremony generates the proving and verifying keys needed for our ZK circuits. This is a **critical security component** - if compromised, the entire system is broken.

## Ceremony Architecture

### Two-Phase Process
1. **Phase 1**: Universal Powers of Tau ceremony (circuit-independent)
2. **Phase 2**: Circuit-specific key generation (uses our modified circuits)

### Security Model
- **Assumption**: At least 1 participant in EACH phase must be honest
- **Attack**: If ALL participants collude, they can generate fake proofs
- **Mitigation**: Use 5-10+ participants, include well-known entities

## Step-by-Step Implementation

### Phase 1: Powers of Tau Ceremony (Days 1-3)

**Ceremony Coordinator Setup**:
```bash
# ceremony/phase1/
mkdir -p ceremony/phase1
cd ceremony/phase1

# Initialize ceremony for 2^20 constraints (1M max)
snarkjs powersoftau new bn128 20 pot20_0000.ptau

# Verify initial parameters
snarkjs powersoftau verify pot20_0000.ptau
```

**Participant Contribution Process**:
```bash
# Each participant runs this:
snarkjs powersoftau contribute pot20_input.ptau pot20_output.ptau \
  --name="Participant_Name" \
  --verbose

# Participant must:
# 1. Generate secure randomness (use hardware RNG if possible)
# 2. Verify their contribution
# 3. Securely delete intermediate files
# 4. Publish contribution hash for transparency
```

**Contribution Chain**:
```bash
# Participant 1
snarkjs powersoftau contribute pot20_0000.ptau pot20_0001.ptau --name="Alice"

# Participant 2  
snarkjs powersoftau contribute pot20_0001.ptau pot20_0002.ptau --name="Bob"

# Participant 3
snarkjs powersoftau contribute pot20_0002.ptau pot20_0003.ptau --name="Charlie"

# ... continue for all participants

# Final beacon (public randomness)
snarkjs powersoftau beacon pot20_final.ptau pot20_beacon.ptau \
  0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20 \
  --name="Final Beacon"
```

**Verification Script** (`verify_phase1.sh`):
```bash
#!/bin/bash
set -e

echo "Verifying Phase 1 ceremony..."

# Verify each contribution
for i in {0..5}; do
    echo "Verifying contribution $i..."
    snarkjs powersoftau verify pot20_000$i.ptau
done

echo "Verifying final beacon..."
snarkjs powersoftau verify pot20_beacon.ptau

echo "Phase 1 verification complete ✅"
```

### Phase 2: Circuit-Specific Setup (Days 4-5)

**Prerequisites**:
- Completed Phase 1 ceremony
- Compiled circuit R1CS files from circuits team
- Verified circuit constraint counts

**Setup Process**:
```bash
# ceremony/phase2/
mkdir -p ceremony/phase2
cd ceremony/phase2

# Copy Phase 1 output
cp ../phase1/pot20_beacon.ptau ./

# Generate initial circuit-specific keys
snarkjs groth16 setup ../../circuits/build/withdraw.r1cs pot20_beacon.ptau withdraw_0000.zkey

# Verify initial setup
snarkjs zkey verify ../../circuits/build/withdraw.r1cs pot20_beacon.ptau withdraw_0000.zkey
```

**Circuit-Specific Contributions**:
```bash
# Participant 1
snarkjs zkey contribute withdraw_0000.zkey withdraw_0001.zkey \
  --name="Alice_Circuit" --verbose

# Participant 2
snarkjs zkey contribute withdraw_0001.zkey withdraw_0002.zkey \
  --name="Bob_Circuit" --verbose

# Participant 3  
snarkjs zkey contribute withdraw_0002.zkey withdraw_final.zkey \
  --name="Charlie_Circuit" --verbose

# Apply final beacon
snarkjs zkey beacon withdraw_final.zkey withdraw_beacon.zkey \
  0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20 \
  --name="Circuit_Beacon"
```

**Extract Keys for Production**:
```bash
# Extract verifying key for Solana program
snarkjs zkey export verificationkey withdraw_beacon.zkey verification_key.json

# Export proving key for frontend
cp withdraw_beacon.zkey proving_key.zkey

# Verify final keys
snarkjs zkey verify ../../circuits/build/withdraw.r1cs pot20_beacon.ptau withdraw_beacon.zkey
```

### Ceremony Coordination

**Participant Requirements**:
```yaml
participants:
  minimum: 5
  recommended: 10
  requirements:
    - Trusted community members
    - Geographic distribution
    - Technical competence
    - Secure hardware access
    - Reliable internet connection
```

**Communication Protocol**:
```bash
# ceremony/coordination/
├── participants.md      # List of participants and contact info
├── schedule.md         # Ceremony timeline and deadlines  
├── instructions.md     # Detailed participant instructions
├── verification.md     # How to verify contributions
└── emergency.md        # Backup plans and recovery procedures
```

**Participant Instructions** (`instructions.md`):
```markdown
# Ceremony Participation Instructions

## Security Requirements
1. **Use dedicated machine** - No other processes running
2. **Disconnect from internet** during contribution generation
3. **Use hardware RNG** if available (e.g., /dev/hwrng)
4. **Verify all downloads** using provided checksums
5. **Securely delete** all intermediate files after contribution

## Contribution Process
1. Download previous contribution file
2. Verify file integrity using provided hash
3. Run contribution command with your name
4. Verify your contribution was applied correctly
5. Upload result and publish contribution hash
6. Securely delete all local files

## Emergency Contacts
- Ceremony Coordinator: [contact info]
- Technical Support: [contact info]
- Backup Coordinator: [contact info]
```

### Security Verification

**Contribution Verification** (`verify_contributions.js`):
```javascript
const snarkjs = require("snarkjs");
const fs = require("fs");

async function verifyAllContributions() {
    const contributions = [
        "pot20_0000.ptau",
        "pot20_0001.ptau", 
        "pot20_0002.ptau",
        // ... all contributions
        "pot20_beacon.ptau"
    ];
    
    for (let i = 0; i < contributions.length; i++) {
        console.log(`Verifying ${contributions[i]}...`);
        
        const verification = await snarkjs.powersoftau.verify(contributions[i]);
        if (!verification) {
            throw new Error(`Verification failed for ${contributions[i]}`);
        }
        
        console.log(`✅ ${contributions[i]} verified`);
    }
    
    console.log("All contributions verified successfully!");
}

verifyAllContributions().catch(console.error);
```

**Transcript Generation** (`generate_transcript.js`):
```javascript
// Generate public transcript of ceremony
async function generateTranscript() {
    const transcript = {
        ceremony_type: "Groth16 Trusted Setup",
        circuit: "Tornado Cash Withdraw",
        phase1: {
            participants: ["Alice", "Bob", "Charlie", "Dave", "Eve"],
            contributions: [
                { participant: "Alice", hash: "0x123...", timestamp: "2024-01-01T00:00:00Z" },
                // ... all contributions
            ]
        },
        phase2: {
            participants: ["Alice", "Bob", "Charlie"],
            contributions: [
                { participant: "Alice", hash: "0x456...", timestamp: "2024-01-02T00:00:00Z" },
                // ... all contributions  
            ]
        },
        final_keys: {
            proving_key_hash: "0x789...",
            verifying_key_hash: "0xabc...",
            verification_status: "VERIFIED"
        }
    };
    
    fs.writeFileSync("ceremony_transcript.json", JSON.stringify(transcript, null, 2));
    console.log("Ceremony transcript generated ✅");
}
```

## Integration Points

### With Circuits Team
- **R1CS Files**: Need compiled circuit constraint systems
- **Parameter Verification**: Ensure circuit parameters are finalized
- **Constraint Count**: Verify circuits are optimized before ceremony

### With Solana Program Team  
- **Verifying Key**: Provide verification_key.json for on-chain verification
- **Key Format**: Ensure compatibility with Light Protocol's verifier
- **Integration Testing**: Test key works with actual program

### With Frontend Team
- **Proving Key**: Provide proving_key.zkey for browser-based proving
- **WASM Compatibility**: Ensure keys work with compiled circuits
- **Performance Testing**: Verify proving times are acceptable

## Timeline and Milestones

**Week 1 (Days 1-3): Phase 1 Ceremony**
- [ ] Coordinate participants and schedule
- [ ] Initialize Powers of Tau ceremony
- [ ] Collect all participant contributions
- [ ] Apply final beacon and verify

**Week 2 (Days 4-5): Phase 2 Setup**
- [ ] Generate circuit-specific initial keys
- [ ] Collect circuit-specific contributions  
- [ ] Apply final beacon and extract keys
- [ ] Verify all keys and generate transcript

**Week 2 (Days 6-7): Integration**
- [ ] Deliver keys to Solana and frontend teams
- [ ] Conduct integration testing
- [ ] Publish ceremony transcript
- [ ] Archive ceremony artifacts

## Security Checklist

**Before Ceremony**:
- [ ] Participant security briefing completed
- [ ] Backup coordinators identified
- [ ] Emergency procedures documented
- [ ] Communication channels secured

**During Ceremony**:
- [ ] Each contribution verified before accepting
- [ ] Participant security procedures followed
- [ ] Real-time verification of ceremony integrity
- [ ] Backup copies of all artifacts maintained

**After Ceremony**:
- [ ] Final verification of all keys completed
- [ ] Public transcript published
- [ ] Integration testing successful
- [ ] Ceremony artifacts securely archived

## Common Issues and Solutions

**Participant Unavailability**:
- **Solution**: Have 2-3 backup participants ready
- **Prevention**: Confirm availability 48 hours before their slot

**Contribution Verification Failure**:
- **Solution**: Restart from last valid contribution
- **Prevention**: Verify each contribution immediately

**Network/Hardware Issues**:
- **Solution**: Use backup coordinator and alternative communication
- **Prevention**: Test all systems before ceremony starts

**Key Compatibility Issues**:
- **Solution**: Regenerate keys with correct parameters
- **Prevention**: Extensive integration testing before ceremony

## Success Criteria

- [ ] Phase 1 ceremony completed with 5+ participants
- [ ] Phase 2 ceremony completed with 3+ participants  
- [ ] All contributions verified successfully
- [ ] Keys integrate successfully with Solana program
- [ ] Keys work correctly with frontend proving system
- [ ] Public transcript published and verified
- [ ] No security incidents during ceremony

The ceremony is the **most critical security component** - take no shortcuts here! 🔐
