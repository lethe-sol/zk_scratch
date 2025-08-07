const circomlib = require("circomlib");
const snarkjs = require("snarkjs");
const fs = require("fs");

async function testWithdrawCircuit() {
    console.log("🧪 Testing withdraw circuit...");
    
    const nullifier = "123456789012345678901234567890123456789012345678901234567890123";
    const secret = "987654321098765432109876543210987654321098765432109876543210987";
    
    const poseidon = await circomlib.buildPoseidon();
    const commitment = poseidon([nullifier, secret]);
    const nullifierHash = poseidon([nullifier]);
    
    const pathElements = new Array(20).fill("0");
    const pathIndices = new Array(20).fill(0);
    
    const recipientPubkey = "11111111111111111111111111111112";
    const recipient_1 = recipientPubkey.slice(0, 16);
    const recipient_2 = recipientPubkey.slice(16, 32);
    
    const input = {
        root: "12345678901234567890123456789012",
        nullifierHash: nullifierHash.toString(),
        recipient_1: recipient_1,
        recipient_2: recipient_2,
        relayer_1: "0",
        relayer_2: "0", 
        fee: "0",
        
        nullifier: nullifier,
        secret: secret,
        pathElements: pathElements,
        pathIndices: pathIndices
    };
    
    console.log("Input prepared:", Object.keys(input));
    console.log("✅ Circuit test inputs generated successfully!");
    
    return input;
}

testWithdrawCircuit().catch(console.error);
