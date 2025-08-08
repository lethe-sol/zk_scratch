// scripts/deposit.ts
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";

// ---------- CONFIG ----------
const RPC_URL = "https://api.devnet.solana.com";
const PROGRAM_ID = new PublicKey("2xBPdkCzfwFdc6khqbvaAvYxWcKMRaueXeVyaLRoWDrN");
const DEPOSIT_AMOUNT = 100_000_000; // 0.1 SOL in lamports

// SPL programs (cluster-wide constants)
const SPL_ACCOUNT_COMPRESSION_PROGRAM_ID = new PublicKey(
  "compr6CUsB5m2jS4Y3831ztGSTnDpnKJTKS95d64XVq"
);
const SPL_NOOP_PROGRAM_ID = new PublicKey(
  "noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV"
);

// ---------- UTIL ----------
function simpleHash(inputs: number[]): Uint8Array {
  const p =
    21888242871839275222246405745257275088548364400416034343698204186575808495617n;
  let h = 0n;
  for (let i = 0; i < inputs.length; i++) {
    h = (h + BigInt(inputs[i]) * BigInt(i + 1)) % p;
  }
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    out[i] = Number(h & 0xffn);
    h >>= 8n;
  }
  return out; // bytes32 LE (be consistent with your circuit)
}

async function main() {
  const connection = new Connection(RPC_URL, "confirmed");

  // Use local wallet (requires ANCHOR_WALLET or keypair in ~/.config/solana/id.json)
  const provider = new anchor.AnchorProvider(
    connection,
    anchor.AnchorProvider.local().wallet,
    { commitment: "confirmed" }
  );
  anchor.setProvider(provider);

  // Load and patch IDL so legacy Program ctor can read programId from idl.metadata.address
  const fs = require("fs");
  const path = require("path");
  const idlPath = path.join(__dirname, "tornado_mixer.json");
  const raw = JSON.parse(fs.readFileSync(idlPath, "utf8"));
  raw.metadata = { ...(raw.metadata ?? {}), address: PROGRAM_ID.toBase58() };
  const idl = raw as anchor.Idl;

  // Legacy ctor: (idl, provider)
  const program = new anchor.Program(idl, provider) as Program;

  // ---- Create toy commitment/nullifier (replace with Poseidon for real flow) ----
  const nullifier = Math.floor(Math.random() * 2 ** 30);
  const secret = Math.floor(Math.random() * 2 ** 30);

  console.log("🔐 Generating commitment...");
  console.log("Nullifier:", nullifier);
  console.log("Secret:", secret);

  const commitment = simpleHash([nullifier, secret]); // Uint8Array(32)
  const nullifierHash = simpleHash([nullifier]);

  console.log("Commitment:", Array.from(commitment.slice(0, 8)).join(","), "... (32)");
  console.log("Nullifier Hash:", Array.from(nullifierHash.slice(0, 8)).join(","), "... (32)");

  // ---- PDAs (must match your on-chain seeds) ----
  const [vaultPda] = PublicKey.findProgramAddressSync([Buffer.from("vault")], PROGRAM_ID);
  const [merkleTreePda] = PublicKey.findProgramAddressSync([Buffer.from("tree")], PROGRAM_ID);
  const [configPda] = PublicKey.findProgramAddressSync([Buffer.from("config")], PROGRAM_ID);

  // ---- Balances & sanity checks ----
  const walletPk = provider.wallet.publicKey;
  console.log("\n💰 Making deposit...");
  console.log("Program ID:", PROGRAM_ID.toBase58());
  console.log("Wallet:", walletPk.toBase58());
  console.log("Vault PDA:", vaultPda.toBase58());
  console.log("Merkle Tree PDA:", merkleTreePda.toBase58());
  console.log("Config PDA:", configPda.toBase58());
  console.log("Deposit Amount:", DEPOSIT_AMOUNT / 1e9, "SOL");

  const walletBalance = await connection.getBalance(walletPk);
  console.log("Wallet balance before:", walletBalance / 1e9, "SOL");
  if (walletBalance < DEPOSIT_AMOUNT + 5_000) {
    throw new Error("Insufficient wallet balance for deposit + fees");
  }

  // ---- RPC ----
  const txSig = await program.methods
    .deposit([...commitment]) // Anchor will accept number[] for bytes
    .accounts({
      user: walletPk,
      config: configPda,
      merkleTree: merkleTreePda,
      vault: vaultPda,
      compressionProgram: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
      noopProgram: SPL_NOOP_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  console.log("✅ Deposit successful!");
  console.log("Transaction signature:", txSig);

  // Optional: confirm append CPI happened
  const parsed = await connection.getTransaction(txSig, {
    maxSupportedTransactionVersion: 0,
    commitment: "confirmed",
  });

  const programIds =
    parsed?.meta?.innerInstructions
      ?.flatMap((ii: any) =>
        ii.instructions.map(
          (ix: any) =>
            parsed.transaction.message.staticAccountKeys[ix.programIdIndex].toBase58()
        )
      ) ?? [];

  const sawCompression = programIds.includes(
    SPL_ACCOUNT_COMPRESSION_PROGRAM_ID.toBase58()
  );
  const sawNoop = programIds.includes(SPL_NOOP_PROGRAM_ID.toBase58());

  console.log(
    `🔎 Inner CPI → compression: ${sawCompression ? "yes" : "no"}, noop: ${
      sawNoop ? "yes" : "no"
    }`
  );

  const walletAfter = await connection.getBalance(walletPk);
  const vaultAfter = await connection.getBalance(vaultPda);

  console.log("\n📊 Balances after deposit:");
  console.log("Wallet balance:", walletAfter / 1e9, "SOL");
  console.log("Vault balance:", vaultAfter / 1e9, "SOL");

  // Save a note file for testing withdraw later
  const depositInfo = {
    nullifier,
    secret,
    commitment: Array.from(commitment),
    nullifierHash: Array.from(nullifierHash),
    transactionSignature: txSig,
    timestamp: new Date().toISOString(),
    note:
      "⚠️ Toy hash for testing. Replace with Poseidon consistent with your circuit before wiring withdraw.",
  };

  const outPath = path.join(__dirname, `deposit_${Date.now()}.json`);
  fs.writeFileSync(outPath, JSON.stringify(depositInfo, null, 2));
  console.log("\n💾 Deposit info saved to:", outPath);
  console.log("⚠️ Keep this file safe - you'll need it for withdrawal!");
  console.log("⚠️ Ensure tree depth/buffer match your circuit (e.g., depth=20).");
}

main().catch((e) => {
  console.error("❌ Deposit failed:", e);
  process.exit(1);
});
