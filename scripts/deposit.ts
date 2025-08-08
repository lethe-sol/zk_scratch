import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import crypto from "crypto";
import fs from "fs";
import path from "path";

const PROGRAM_ID = new PublicKey("2xBPdkCzfwFdc6khqbvaAvYxWcKMRaueXeVyaLRoWDrN");
const DEPOSIT_AMOUNT = 100_000_000; // 0.1 SOL (only relevant if your on-chain code transfers)

const SPL_ACCOUNT_COMPRESSION_PROGRAM_ID = new PublicKey("cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK");
const SPL_NOOP_PROGRAM_ID = new PublicKey("noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV");

// Toy hash function (little-endian bytes) — unchanged
function simpleHash(inputs: number[]): number[] {
  const p =
    21888242871839275222246405745257275088548364400416034343698204186575808495617n;
  let h = 0n;
  for (let i = 0; i < inputs.length; i++) {
    h = (h + BigInt(inputs[i]) * BigInt(i + 1)) % p;
  }
  const out = new Array<number>(32).fill(0);
  for (let i = 0; i < 32; i++) {
    out[i] = Number(h & 0xffn);
    h >>= 8n;
  }
  return out;
}

async function deposit() {
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  const provider = new anchor.AnchorProvider(
    connection,
    anchor.AnchorProvider.local().wallet,
    { commitment: "confirmed" }
  );
  anchor.setProvider(provider);

  const wallet = provider.wallet.publicKey;

  // Derive PDAs same as your current code
  const [vaultPda] = PublicKey.findProgramAddressSync([Buffer.from("vault")], PROGRAM_ID);
  const [merkleTreePda] = PublicKey.findProgramAddressSync([Buffer.from("tree")], PROGRAM_ID);
  const [configPda] = PublicKey.findProgramAddressSync([Buffer.from("config")], PROGRAM_ID);

  // Build commitment & note info
  const nullifier = Math.floor(Math.random() * 2 ** 30);
  const secret = Math.floor(Math.random() * 2 ** 30);
  const commitment = simpleHash([nullifier, secret]); // 32 byte number[]
  const nullifierHash = simpleHash([nullifier]);

  console.log("🔐 commitment[0..8]:", commitment.slice(0, 8));

  // ---- Build raw instruction data: discriminator + commitment bytes ----
  const disc = crypto.createHash("sha256").update("global:deposit").digest().slice(0, 8);
  const data = Buffer.concat([disc, Buffer.from(commitment)]); // commitment length MUST be 32

  // ---- Accounts: EXACT order from your IDL ----
  const keys = [
    { pubkey: wallet,                  isSigner: true,  isWritable: true  }, // user
    { pubkey: configPda,               isSigner: false, isWritable: false }, // config
    { pubkey: merkleTreePda,           isSigner: false, isWritable: true  }, // merkle_tree
    { pubkey: vaultPda,                isSigner: false, isWritable: true  }, // vault
    { pubkey: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID, isSigner: false, isWritable: false }, // compression_program
    { pubkey: SPL_NOOP_PROGRAM_ID,     isSigner: false, isWritable: false }, // noop_program
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
  ];

  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys,
    data,
  });

  const tx = new Transaction().add(ix);
  const sig = await provider.sendAndConfirm(tx, [], { commitment: "confirmed" });

  console.log("✅ Deposit sent:", sig);

  // Save a note file (like before)
  const out = {
    nullifier,
    secret,
    commitment,
    nullifierHash,
    tx: sig,
    timestamp: new Date().toISOString(),
    note: "Toy hash only. Swap to Poseidon to match circuit before withdraw.",
  };
  const fp = path.join(__dirname, `deposit_${Date.now()}.json`);
  fs.writeFileSync(fp, JSON.stringify(out, null, 2));
  console.log("💾 Saved:", fp);
}

deposit().catch((e) => {
  console.error("❌ Deposit failed:", e);
  process.exit(1);
});
