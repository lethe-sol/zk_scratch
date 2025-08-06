const circomlib = require("circomlib");

async function debugCircuitLogic() {
    console.log("🔍 Debugging circuit logic...");
    
    const nullifier = "123456789012345678901234567890123456789012345678901234567890123";
    const secret = "987654321098765432109876543210987654321098765432109876543210987";
    
    const poseidon = circomlib.poseidon;
    
    const commitment = poseidon([nullifier, secret]);
    console.log("1. Commitment:", commitment.toString());
    
    const nullifierHash = poseidon([nullifier]);
    console.log("2. Nullifier Hash:", nullifierHash.toString());
    
    let currentHash = commitment;
    console.log("3. Starting with leaf (commitment):", currentHash.toString());
    
    for (let i = 0; i < 20; i++) {
        currentHash = poseidon([currentHash, 0]);
        console.log(`   Level ${i + 1}: ${currentHash.toString()}`);
    }
    
    console.log("4. Final root after 20 levels:", currentHash.toString());
    
    const input = {
        root: currentHash.toString(),
        nullifierHash: nullifierHash.toString(),
        recipient_1: "12345678901234567890123456789012",
        recipient_2: "34567890123456789012345678901234",
        relayer_1: "0",
        relayer_2: "0",
        fee: "0",
        nullifier: nullifier,
        secret: secret,
        pathElements: Array(20).fill("0"),
        pathIndices: Array(20).fill(0)
    };
    
    console.log("5. Generated input with correct root:", JSON.stringify(input, null, 2));
    return input;
}

debugCircuitLogic().catch(console.error);
