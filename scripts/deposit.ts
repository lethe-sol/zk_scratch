import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";

const PROGRAM_ID = new PublicKey("2xBPdkCzfwFdc6khqbvaAvYxWcKMRaueXeVyaLRoWDrN");
const DEPOSIT_AMOUNT = 100_000_000; // 0.1 SOL in lamports

function simpleHash(inputs: number[]): string {
  let hash = 0;
  for (let i = 0; i < inputs.length; i++) {
    hash = (hash + inputs[i] * (i + 1)) % 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
  }
  return hash.toString();
}

async function deposit() {
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  
  const wallet = anchor.AnchorProvider.local().wallet;
  
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  const fs = require('fs');
  const path = require('path');
  const idlPath = path.join(__dirname, 'tornado_mixer.json');
  const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
  const program = new anchor.Program(idl, provider);

  try {
    const nullifier = Math.floor(Math.random() * 2**30); // 30-bit to be safe
    const secret = Math.floor(Math.random() * 2**30);    // 30-bit to be safe
    
    console.log("🔐 Generating commitment...");
    console.log("Nullifier:", nullifier);
    console.log("Secret:", secret);
    
    const commitment = simpleHash([nullifier, secret]);
    console.log("Commitment:", commitment);
    
    const nullifierHash = simpleHash([nullifier]);
    console.log("Nullifier Hash:", nullifierHash);

    const [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault")],
      PROGRAM_ID
    );

    const [merkleTreePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("tree")],
      PROGRAM_ID
    );

    const [configPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      PROGRAM_ID
    );

    console.log("\n💰 Making deposit...");
    console.log("Program ID:", PROGRAM_ID.toString());
    console.log("Wallet:", wallet.publicKey.toString());
    console.log("Vault PDA:", vaultPda.toString());
    console.log("Merkle Tree PDA:", merkleTreePda.toString());
    console.log("Config PDA:", configPda.toString());
    console.log("Deposit Amount:", DEPOSIT_AMOUNT / 1e9, "SOL");

    const walletBalance = await connection.getBalance(wallet.publicKey);
    console.log("Wallet balance before:", walletBalance / 1e9, "SOL");
    
    if (walletBalance < DEPOSIT_AMOUNT + 5000) { // 5000 lamports for transaction fees
      throw new Error("Insufficient wallet balance for deposit + fees");
    }

    const tx = await program.methods
      .deposit(commitment)
      .accounts({
        depositor: wallet.publicKey,
        vault: vaultPda,
        merkleTree: merkleTreePda,
        config: configPda,
        systemProgram: SystemProgram.programId,
        compressionProgram: new PublicKey("compr6CUsB5m2jS4Y3831ztGSTnDpnKJTKS95d64XVq"),
      })
      .rpc();

    console.log("✅ Deposit successful!");
    console.log("Transaction signature:", tx);
    
    const walletBalanceAfter = await connection.getBalance(wallet.publicKey);
    const vaultBalanceAfter = await connection.getBalance(vaultPda);
    
    console.log("\n📊 Balances after deposit:");
    console.log("Wallet balance:", walletBalanceAfter / 1e9, "SOL");
    console.log("Vault balance:", vaultBalanceAfter / 1e9, "SOL");
    
    const depositInfo = {
      nullifier,
      secret,
      commitment,
      nullifierHash,
      transactionSignature: tx,
      timestamp: new Date().toISOString(),
      note: "⚠️ This uses a simple hash for testing. For production withdrawals, use proper Poseidon hash matching the circuits."
    };
    
    const depositInfoPath = path.join(__dirname, `deposit_${Date.now()}.json`);
    fs.writeFileSync(depositInfoPath, JSON.stringify(depositInfo, null, 2));
    console.log("\n💾 Deposit info saved to:", depositInfoPath);
    console.log("⚠️  Keep this file safe - you'll need it for withdrawal!");
    console.log("⚠️  Note: Current merkle tree depth (6) doesn't match circuit depth (20)");

  } catch (error) {
    console.error("❌ Deposit failed:", error);
  }
}

deposit().catch(console.error);
