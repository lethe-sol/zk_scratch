import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import {
  SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
  SPL_NOOP_PROGRAM_ID,
} from "@solana/spl-account-compression";

const PROGRAM_ID = new PublicKey("2xBPdkCzfwFdc6khqbvaAvYxWcKMRaueXeVyaLRoWDrN");
const DEPOSIT_AMOUNT = 100_000_000; // 0.1 SOL in lamports

function simpleHash(inputs: number[]): number[] {
  const p =
    21888242871839275222246405745257275088548364400416034343698204186575808495617n;
  let h = 0n;
  for (let i = 0; i < inputs.length; i++) {
    h = (h + BigInt(inputs[i]) * BigInt(i + 1)) % p;
  }
  // LITTLE-endian bytes (keep consistent with your circuit or swap to BE)
  const out = new Array<number>(32).fill(0);
  for (let i = 0; i < 32; i++) {
    out[i] = Number(h & 0xffn);
    h >>= 8n;
  }
  return out; // number[32]
}

async function deposit() {
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  const wallet = anchor.AnchorProvider.local().wallet;

  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  const fs = require("fs");
  const path = require("path");
  const idlPath = path.join(__dirname, "tornado_mixer.json");
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf8"));

  // IMPORTANT: pass PROGRAM_ID, not provider
  const program = new anchor.Program(idl, PROGRAM_ID, provider) as Program;

  try {
    const nullifier = Math.floor(Math.random() * 2 ** 30);
    const secret = Math.floor(Math.random() * 2 ** 30);

    console.log("🔐 Generating commitment...");
    console.log("Nullifier:", nullifier);
    console.log("Secret:", secret);

    const commitment = simpleHash([nullifier, secret]); // number[32]
    console.log("Commitment:", commitment.slice(0, 8).join(","), "... (32 bytes)");

    const nullifierHash = simpleHash([nullifier]); // number[32]
    console.log(
      "Nullifier Hash:",
      nullifierHash.slice(0, 8).join(","),
      "... (32 bytes)"
    );

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

    if (walletBalance < DEPOSIT_AMOUNT + 5000) {
      throw new Error("Insufficient wallet balance for deposit + fees");
    }

    const tx = await program.methods
      .deposit(commitment)
      .accounts({
        user: wallet.publicKey,
        config: configPda,
        merkleTree: merkleTreePda,
        vault: vaultPda,
        compressionProgram: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
        noopProgram: SPL_NOOP_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("✅ Deposit successful!");
    console.log("Transaction signature:", tx);

    // Optional: confirm append CPI happened
    const parsed = await connection.getTransaction(tx, {
      maxSupportedTransactionVersion: 0,
      commitment: "confirmed",
    });
    const programIds =
      parsed?.meta?.innerInstructions
        ?.flatMap((ii: any) =>
          ii.instructions.map(
            (ix: any) => parsed.transaction.message.staticAccountKeys[ix.programIdIndex].toBase58()
          )
        ) || [];
    const sawCompression = programIds.includes(
      SPL_ACCOUNT_COMPRESSION_PROGRAM_ID.toBase58()
    );
    const sawNoop = programIds.includes(SPL_NOOP_PROGRAM_ID.toBase58());
    console.log(
      `🔎 Inner CPI → compression: ${sawCompression ? "yes" : "no"}, noop: ${
        sawNoop ? "yes" : "no"
      }`
    );

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
      note:
        "⚠️ Toy hash for testing. Use Poseidon consistent with your circuit before wiring withdraw.",
    };

    const depositInfoPath = path.join(__dirname, `deposit_${Date.now()}.json`);
    fs.writeFileSync(depositInfoPath, JSON.stringify(depositInfo, null, 2));
    console.log("\n💾 Deposit info saved to:", depositInfoPath);
    console.log("⚠️ Keep this file safe - you'll need it for withdrawal!");
    console.log(
      "⚠️ Note: Current merkle tree depth (6) doesn't match circuit depth (20)"
    );
  } catch (error) {
    console.error("❌ Deposit failed:", error);
  }
}

deposit().catch(console.error);
