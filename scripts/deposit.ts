import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import fs from "fs";
import path from "path";

const PROGRAM_ID = new PublicKey("2xBPdkCzfwFdc6khqbvaAvYxWcKMRaueXeVyaLRoWDrN");
const DEPOSIT_AMOUNT = 100_000_000; // 0.1 SOL

const SPL_ACCOUNT_COMPRESSION_PROGRAM_ID = new PublicKey(
  "cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK"
);
const SPL_NOOP_PROGRAM_ID = new PublicKey(
  "noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV"
);

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

  // --- Load & patch IDL: strip 'accounts' so Anchor won't try to build Account clients ---
  const idlPath = path.join(__dirname, "tornado_mixer.json");
  const idlRaw = JSON.parse(fs.readFileSync(idlPath, "utf8"));
  if (!idlRaw?.instructions) throw new Error("IDL missing instructions array");
  const idlPatched: any = { ...idlRaw };
  delete idlPatched.accounts; // <-- critical hack for your current IDL shape

  // Build Program in a version-agnostic way (try both ctor orders)
  const ProgramCtor: any = (anchor as any).Program;
  let program: any;
  try {
    // Newer: (idl, programId, provider)
    program = new ProgramCtor(idlPatched, PROGRAM_ID, provider);
  } catch {
    // Older: (idl, provider, programId)
    program = new ProgramCtor(idlPatched, provider, PROGRAM_ID);
  }

  // Sanity: make sure instruction encoder exists
  if (!program?.coder?.instruction?.encode) {
    throw new Error("Program coder not initialized (bad ctor order or invalid IDL).");
  }

  // ---- Generate toy commitment (unchanged) ----
  const nullifier = Math.floor(Math.random() * 2 ** 30);
  const secret = Math.floor(Math.random() * 2 ** 30);
  const commitment = simpleHash([nullifier, secret]);
  const nullifierHash = simpleHash([nullifier]);

  // ---- PDAs (your original seeds) ----
  const [vaultPda] = PublicKey.findProgramAddressSync([Buffer.from("vault")], PROGRAM_ID);
  const [merkleTreePda] = PublicKey.findProgramAddressSync([Buffer.from("tree")], PROGRAM_ID);
  const [configPda] = PublicKey.findProgramAddressSync([Buffer.from("config")], PROGRAM_ID);

  // ---- EXACT IDL account names for 'deposit' ----
  const accounts = {
    user: provider.wallet.publicKey,                       // signer & writable
    config: configPda,                                     // MixerConfig PDA
    merkle_tree: merkleTreePda,                            // writable
    vault: vaultPda,                                       // writable (PDA "vault")
    compression_program: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
    noop_program: SPL_NOOP_PROGRAM_ID,
    system_program: SystemProgram.programId,
  };

  console.log("\n📦 Accounts being sent to deposit():",
    Object.fromEntries(Object.entries(accounts).map(([k, v]) => [k, (v as PublicKey).toBase58()]))
  );

  // (Optional) balance check; your program should transfer inside the handler
  const bal = await connection.getBalance(provider.wallet.publicKey);
  if (bal < DEPOSIT_AMOUNT + 5_000) {
    console.warn("⚠️ Low balance for a real transfer; proceeding anyway for tree test.");
  }

  // ---- Call deposit ----
  const tx = await program.methods.deposit(commitment as number[]).accounts(accounts).rpc();
  console.log("✅ Deposit successful! tx:", tx);

  // Save a note file like before
  const note = {
    nullifier,
    secret,
    commitment,
    nullifierHash,
    tx,
    timestamp: new Date().toISOString(),
    note: "Toy hash only. Swap to Poseidon consistent with your circuit.",
  };
  const fp = path.join(__dirname, `deposit_${Date.now()}.json`);
  fs.writeFileSync(fp, JSON.stringify(note, null, 2));
  console.log("💾 Saved:", fp);
}

deposit().catch((e) => {
  console.error("❌ Deposit failed:", e);
  process.exit(1);
});
