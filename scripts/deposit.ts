import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import fs from "fs";
import path from "path";

const PROGRAM_ID = new PublicKey("2xBPdkCzfwFdc6khqbvaAvYxWcKMRaueXeVyaLRoWDrN");
const DEPOSIT_AMOUNT = 100_000_000; // 0.1 SOL in lamports

// Hardcoded program IDs for State/Account Compression + Noop
const SPL_ACCOUNT_COMPRESSION_PROGRAM_ID = new PublicKey(
  "cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK"
);
const SPL_NOOP_PROGRAM_ID = new PublicKey(
  "noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV"
);

// Toy hash function (little-endian bytes)
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

  // --- Load IDL (do NOT mutate it) ---
  const idlPath = path.join(__dirname, "tornado_mixer.json");
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf8"));
  if (!idl?.instructions) throw new Error("IDL missing instructions array");

  // --- Build Program with version-agnostic ctor ---
  const ProgramCtor: any = (anchor as any).Program;
  let program: any;
  try {
    // Common in newer Anchor: (idl, programId, provider)
    program = new ProgramCtor(idl, PROGRAM_ID, provider);
  } catch {
    // Older signature some people have installed: (idl, provider, programId)
    program = new ProgramCtor(idl, provider, PROGRAM_ID);
  }

  if (!program?.coder?.instruction?.encode) {
    throw new Error("Program coder not initialized (bad ctor order or invalid IDL).");
  }

  // --- Figure out what the IDL expects for `deposit` ---
  const depIx = idl.instructions.find((ix: any) => ix.name === "deposit");
  if (!depIx) throw new Error("IDL has no 'deposit' instruction");
  console.log("IDL deposit args:", depIx.args);
  console.log("IDL deposit accounts:", depIx.accounts.map((a: any) => a.name));

  // --- Generate toy commitment ---
  const nullifier = Math.floor(Math.random() * 2 ** 30);
  const secret = Math.floor(Math.random() * 2 ** 30);

  console.log("🔐 Generating commitment...");
  console.log("Nullifier:", nullifier, "Secret:", secret);

  const commitment = simpleHash([nullifier, secret]);
  const nullifierHash = simpleHash([nullifier]);

  // --- Derive PDAs (your original seeds) ---
  const [vaultPda] = PublicKey.findProgramAddressSync([Buffer.from("vault")], PROGRAM_ID);
  const [merkleTreePda] = PublicKey.findProgramAddressSync([Buffer.from("tree")], PROGRAM_ID);
  const [configPda] = PublicKey.findProgramAddressSync([Buffer.from("config")], PROGRAM_ID);

  const wallet = provider.wallet.publicKey;

  // --- Auto-map account names from IDL to your available keys ---
  const candidateValues: Record<string, PublicKey> = {
    user: wallet,
    depositor: wallet,

    config: configPda,
    vault_state: configPda,

    merkleTree: merkleTreePda,
    merkle_tree: merkleTreePda,

    treeAuthority: merkleTreePda,
    tree_authority: merkleTreePda,

    vault: vaultPda,

    compressionProgram: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
    compression_program: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,

    noopProgram: SPL_NOOP_PROGRAM_ID,
    noop_program: SPL_NOOP_PROGRAM_ID,

    systemProgram: SystemProgram.programId,
    system_program: SystemProgram.programId,
  };

  const accounts: Record<string, PublicKey> = {};
  for (const a of depIx.accounts) {
    const name = a.name as string;
    const v = candidateValues[name];
    if (!v) {
      throw new Error(
        `No mapping for required account '${name}'. Known keys: ${Object.keys(candidateValues).join(", ")}`
      );
    }
    accounts[name] = v;
  }

  console.log(
    "\n📦 Accounts being sent to deposit():",
    Object.fromEntries(Object.entries(accounts).map(([k, v]) => [k, v.toBase58()]))
  );

  // --- Optional: check wallet balance like before ---
  const bal = await connection.getBalance(wallet);
  if (bal < DEPOSIT_AMOUNT + 5_000) {
    console.warn("⚠️ Low balance for a real transfer; proceeding with call anyway.");
  }

  // --- Call the instruction ---
  const tx = await program.methods.deposit(commitment as number[]).accounts(accounts).rpc();

  console.log("✅ Deposit successful!");
  console.log("Transaction signature:", tx);

  // Save the note file just like before
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
}

deposit().catch((e) => {
  console.error("❌ Deposit failed:", e);
  process.exit(1);
});
