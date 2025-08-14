// scripts/deposit_poseidon.ts
import * as anchor from "@coral-xyz/anchor";
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import * as nodeCrypto from "crypto";
import fs from "fs";
import path from "path";
import { buildPoseidon } from "circomlibjs";

// ---- CONFIG ----
const PROGRAM_ID = new PublicKey("2xBPdkCzfwFdc6khqbvaAvYxWcKMRaueXeVyaLRoWDrN");
const CMT_PID    = new PublicKey("cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK");
const NOOP_PID   = new PublicKey("noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV");

// Your SPL CMT tree (authority = vault PDA)
const TREE_PUBKEY = new PublicKey("5yeiuqLK1Gp4W5PZHTnLCqzDTjEjxyTBUaMo6Z46LvuE");

// BN254 prime
const P = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

// BigInt -> 32B big-endian
function feToBytes32BE(x: bigint): Uint8Array {
  const out = new Uint8Array(32);
  let t = x;
  for (let i = 31; i >= 0; i--) { out[i] = Number(t & 255n); t >>= 8n; }
  return out;
}

// Uniform random field element < P
function randField(): bigint {
  const rnd = BigInt("0x" + nodeCrypto.randomBytes(32).toString("hex"));
  return rnd % P;
}

async function main() {
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  const provider = new anchor.AnchorProvider(
    connection,
    anchor.AnchorProvider.local().wallet,
    { commitment: "confirmed" }
  );
  anchor.setProvider(provider);

  const wallet = provider.wallet.publicKey;

  // PDAs (match on-chain seeds)
  const [vaultPda]  = PublicKey.findProgramAddressSync([Buffer.from("vault")], PROGRAM_ID);
  const [configPda] = PublicKey.findProgramAddressSync([Buffer.from("config")], PROGRAM_ID);

  // ----- Poseidon(commitment) + Poseidon(nullifier) -----
  const poseidon = await buildPoseidon();
  const F = poseidon.F;

  // Choose note secrets
  const nullifier = randField();
  const secret    = randField();

  // leaf = Poseidon([nullifier, secret]), nullifierHash = Poseidon([nullifier])
  const C  = F.toObject(poseidon([nullifier, secret])) as bigint;
  const NH = F.toObject(poseidon([nullifier])) as bigint;

  // Encode to 32 bytes big-endian to match on-chain/circuit expectations
  const commitmentBytes    = feToBytes32BE(C);
  const nullifierHashBytes = feToBytes32BE(NH);

  console.log("payer:", wallet.toBase58());
  console.log("vault PDA:", vaultPda.toBase58());
  console.log("config PDA:", configPda.toBase58());
  console.log("merkleTree:", TREE_PUBKEY.toBase58());
  console.log("🔐 commitment[0..8]:", Array.from(commitmentBytes.slice(0, 8)));

  // ----- Build deposit ix: discriminator("global:deposit") + 32B commitment -----
  const disc = nodeCrypto.createHash("sha256").update("global:deposit").digest().slice(0, 8);
  const data = Buffer.concat([disc, Buffer.from(commitmentBytes)]);

  // Accounts (IDL order): user, config, merkle_tree, vault, compression_program, noop_program, system_program
  const keys = [
    { pubkey: wallet,     isSigner: true,  isWritable: true  },
    { pubkey: configPda,  isSigner: false, isWritable: false },
    { pubkey: TREE_PUBKEY,isSigner: false, isWritable: true  },
    { pubkey: vaultPda,   isSigner: false, isWritable: true  },
    { pubkey: CMT_PID,    isSigner: false, isWritable: false },
    { pubkey: NOOP_PID,   isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  const ix = new TransactionInstruction({ programId: PROGRAM_ID, keys, data });
  const tx = new Transaction().add(ix);
  const sig = await provider.sendAndConfirm(tx, [], { commitment: "confirmed" });
  console.log("✅ Deposit sent:", sig);

  // Quick CPI sanity check
  const parsed = await connection.getTransaction(sig, { maxSupportedTransactionVersion: 0, commitment: "confirmed" });
  const innerPrograms =
    parsed?.meta?.innerInstructions?.flatMap((ii: any) =>
      ii.instructions.map((ix: any) =>
        parsed.transaction.message.staticAccountKeys[ix.programIdIndex].toBase58()
      )
    ) || [];
  console.log(
    `🔎 Inner CPI → compression: ${innerPrograms.includes(CMT_PID.toBase58()) ? "yes" : "no"}, ` +
    `noop: ${innerPrograms.includes(NOOP_PID.toBase58()) ? "yes" : "no"}`
  );

  // Save note for withdraw
  const out = {
    nullifier: nullifier.toString(),          // decimal strings for bigint
    secret:    secret.toString(),
    nullifierHashHex: Buffer.from(nullifierHashBytes).toString("hex"),
    commitmentHex:    Buffer.from(commitmentBytes).toString("hex"),
    tree: TREE_PUBKEY.toBase58(),
    tx: sig,
    timestamp: new Date().toISOString(),
    note: "Poseidon-based note. Use these values for withdraw proof generation.",
  };
  const fp = path.join(__dirname, `deposit_${Date.now()}.json`);
  fs.writeFileSync(fp, JSON.stringify(out, null, 2));
  console.log("💾 Saved:", fp);
}

main().catch((e) => { console.error("❌ Deposit failed:", e); process.exit(1); });
