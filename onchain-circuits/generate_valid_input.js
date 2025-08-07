const circomlib = require("circomlib");

async function generateValidInput() {
    console.log("🔧 Generating valid test input...");
    
    const nullifier = "123456789012345678901234567890123456789012345678901234567890123";
    const secret = "987654321098765432109876543210987654321098765432109876543210987";
    
    const poseidon = circomlib.poseidon;
    
    const commitment = poseidon([nullifier, secret]);
    console.log("Commitment:", commitment.toString());
    
    const nullifierHash = poseidon([nullifier]);
    console.log("Nullifier Hash:", nullifierHash.toString());
    
    const root = commitment.toString();
    
    const recipient_1 = "12345678901234567890123456789012";
    const recipient_2 = "34567890123456789012345678901234";
    
    const input = {
        root: root,
        nullifierHash: nullifierHash.toString(),
        recipient_1: recipient_1,
        recipient_2: recipient_2,
        relayer_1: "0",
        relayer_2: "0",
        fee: "0",
        
        nullifier: nullifier,
        secret: secret,
        pathElements: ["0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0"],
        pathIndices: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
    };
    
    console.log("Generated valid input:", JSON.stringify(input, null, 2));
    return input;
}

generateValidInput().catch(console.error);
