const circomlib = require("circomlib");
const snarkjs = require("snarkjs");

async function verifyPoseidonCompatibility() {
    console.log("🔍 Verifying Poseidon parameter compatibility...");
    
    const input1 = Buffer.alloc(32, 1);
    const input2 = Buffer.alloc(32, 2);
    
    const poseidon = await circomlib.buildPoseidon();
    const hash = poseidon([input1, input2]);
    
    console.log("Hash result:", hash.toString());
    
    const expectedBytes = [13, 84, 225, 147, 143, 138, 140, 28, 125, 235, 94, 3, 85, 242, 99, 25, 32, 123, 132, 254, 156, 162, 206, 27, 38, 231, 53, 200, 41, 130, 25, 144];
    const hashBytes = hash.toString(16).padStart(64, '0').match(/.{2}/g).map(byte => parseInt(byte, 16));
    
    const matches = JSON.stringify(hashBytes) === JSON.stringify(expectedBytes);
    
    if (matches) {
        console.log("✅ Poseidon parameters match Light Protocol!");
    } else {
        console.log("❌ Parameter mismatch detected");
        console.log("Expected:", expectedBytes);
        console.log("Got:", hashBytes);
    }
    
    return matches;
}

verifyPoseidonCompatibility().catch(console.error);
