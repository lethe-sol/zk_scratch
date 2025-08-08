import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import * as fs from 'fs';
import * as path from 'path';

const PROGRAM_ID = new PublicKey("2xBPdkCzfwFdc6khqbvaAvYxWcKMRaueXeVyaLRoWDrN");
const WITHDRAW_AMOUNT = 100_000_000; // 0.1 SOL in lamports

function simpleHash(inputs: number[]): Uint8Array {
  const fieldModulus = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
  let hash = 0n;
  for (let i = 0; i < inputs.length; i++) {
    hash = (hash + BigInt(inputs[i]) * BigInt(i + 1)) % fieldModulus;
  }
  
  const bytes = new Uint8Array(32);
  let hashValue = hash;
  for (let i = 0; i < 32; i++) {
    bytes[i] = Number(hashValue & 0xFFn);
    hashValue >>= 8n;
  }
  return bytes;
}

function generateMockProof(): Uint8Array {
  const proof = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    proof[i] = (i * 7 + 42) % 256;
  }
  return proof;
}

function generateMockRoot(): Uint8Array {
  const root = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    root[i] = (i * 3 + 123) % 256;
  }
  return root;
}

async function withdraw() {
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  
  let wallet: any;
  let provider: any;
  
  try {
    wallet = anchor.AnchorProvider.local().wallet;
    
    provider = new anchor.AnchorProvider(connection, wallet, {
      commitment: "confirmed",
    });
    anchor.setProvider(provider);
  } catch (walletError: any) {
    if (walletError.code === 'ENOENT') {
      console.log("❌ Wallet file not found. Please ensure ANCHOR_WALLET is set to a valid Solana keypair file.");
      console.log("💡 For testing purposes, you can generate a keypair with: solana-keygen new");
      console.log("💡 Or set ANCHOR_WALLET to point to your existing keypair file.");
      return;
    }
    throw walletError;
  }

  const idlPath = path.join(__dirname, 'tornado_mixer.json');
  const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
  const program = new anchor.Program(idl, provider);

  try {
    const depositFiles = fs.readdirSync(__dirname).filter(f => f.startsWith('deposit_') && f.endsWith('.json'));
    
    if (depositFiles.length === 0) {
      throw new Error("No deposit files found. Please run deposit.ts first.");
    }
    
    const latestDepositFile = depositFiles.sort().pop()!;
    const depositPath = path.join(__dirname, latestDepositFile);
    const depositInfo = JSON.parse(fs.readFileSync(depositPath, 'utf8'));
    
    console.log("🔐 Loading deposit info...");
    console.log("Using deposit file:", latestDepositFile);
    console.log("Nullifier:", depositInfo.nullifier);
    console.log("Secret:", depositInfo.secret);
    
    const commitment = new Uint8Array(depositInfo.commitment);
    const nullifierHash = new Uint8Array(depositInfo.nullifierHash);
    
    console.log("Commitment:", Array.from(commitment).slice(0, 8).join(','), "... (32 bytes)");
    console.log("Nullifier Hash:", Array.from(nullifierHash).slice(0, 8).join(','), "... (32 bytes)");

    const mockProof = generateMockProof();
    const mockRoot = generateMockRoot();
    
    console.log("\n🎭 Generating mock withdrawal proof...");
    console.log("Mock Proof:", Array.from(mockProof).slice(0, 8).join(','), "... (256 bytes)");
    console.log("Mock Root:", Array.from(mockRoot).slice(0, 8).join(','), "... (32 bytes)");

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

    const [nullifierPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("nullifier"), nullifierHash],
      PROGRAM_ID
    );

    const recipient = wallet.publicKey;

    console.log("\n💰 Attempting withdrawal...");
    console.log("Program ID:", PROGRAM_ID.toString());
    console.log("Wallet:", wallet.publicKey.toString());
    console.log("Vault PDA:", vaultPda.toString());
    console.log("Merkle Tree PDA:", merkleTreePda.toString());
    console.log("Config PDA:", configPda.toString());
    console.log("Nullifier PDA:", nullifierPda.toString());
    console.log("Recipient:", recipient.toString());
    console.log("Withdraw Amount:", WITHDRAW_AMOUNT / 1e9, "SOL");

    const walletBalance = await connection.getBalance(wallet.publicKey);
    const vaultBalance = await connection.getBalance(vaultPda);
    
    console.log("\n📊 Balances before withdrawal:");
    console.log("Wallet balance:", walletBalance / 1e9, "SOL");
    console.log("Vault balance:", vaultBalance / 1e9, "SOL");

    try {
      const tx = await program.methods
        .withdraw(
          Array.from(mockProof),
          Array.from(mockRoot),
          Array.from(nullifierHash),
          recipient
        )
        .accounts({
          payer: wallet.publicKey,
          config: configPda,
          merkleTree: merkleTreePda,
          vault: vaultPda,
          nullifier: nullifierPda,
          recipient: recipient,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log("✅ Withdrawal successful!");
      console.log("Transaction signature:", tx);
      
      const walletBalanceAfter = await connection.getBalance(wallet.publicKey);
      const vaultBalanceAfter = await connection.getBalance(vaultPda);
      
      console.log("\n📊 Balances after withdrawal:");
      console.log("Wallet balance:", walletBalanceAfter / 1e9, "SOL");
      console.log("Vault balance:", vaultBalanceAfter / 1e9, "SOL");
      
    } catch (withdrawError: any) {
      if (withdrawError.message?.includes("InvalidProof")) {
        console.log("⚠️ Withdrawal failed with InvalidProof (expected with mock proof)");
        console.log("✅ Parameter encoding and instruction structure validated successfully!");
      } else if (withdrawError.message?.includes("NullifierAlreadyUsed")) {
        console.log("⚠️ Withdrawal failed: Nullifier already used (deposit already withdrawn)");
      } else {
        console.log("❌ Withdrawal failed with unexpected error:", withdrawError.message);
        throw withdrawError;
      }
    }

    const withdrawalInfo = {
      depositFile: latestDepositFile,
      nullifier: depositInfo.nullifier,
      secret: depositInfo.secret,
      nullifierHash: Array.from(nullifierHash),
      mockProof: Array.from(mockProof),
      mockRoot: Array.from(mockRoot),
      recipient: recipient.toString(),
      timestamp: new Date().toISOString(),
      note: "⚠️ This uses mock proof for testing. Real withdrawals require valid ZK proofs."
    };
    
    const withdrawalInfoPath = path.join(__dirname, `withdrawal_attempt_${Date.now()}.json`);
    fs.writeFileSync(withdrawalInfoPath, JSON.stringify(withdrawalInfo, null, 2));
    console.log("\n💾 Withdrawal attempt info saved to:", withdrawalInfoPath);

  } catch (error) {
    console.error("❌ Withdrawal test failed:", error);
  }
}

withdraw().catch(console.error);
