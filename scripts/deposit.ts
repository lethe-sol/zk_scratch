import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, Program, Idl } from "@coral-xyz/anchor";
import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import fs from "fs";
import path from "path";

const PROGRAM_ID = new PublicKey("2xBPdkCzfwFdc6khqbvaAvYxWcKMRaueXeVyaLRoWDrN");
const DEPOSIT_AMOUNT = 100_000_000;

const SPL_ACCOUNT_COMPRESSION_PROGRAM_ID = new PublicKey("cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK");
const SPL_NOOP_PROGRAM_ID = new PublicKey("noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV");

function simpleHash(inputs: number[]): number[] { /* your impl unchanged */ }

async function main() {
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  const provider = AnchorProvider.local(); // uses local wallet
  anchor.setProvider(provider);

  // Load IDL (UNMODIFIED)
  const idlPath = path.join(__dirname, "tornado_mixer.json");
  const idlRaw = JSON.parse(fs.readFileSync(idlPath, "utf8"));
  if (!idlRaw?.instructions) throw new Error("IDL missing instructions");
  const idl: Idl = idlRaw;

  // Program (Anchor 0.31.1 signature)
  const program = new Program(idl, PROGRAM_ID, provider);

  // Sanity checks
  const depIx = idl.instructions.find((ix: any) => ix.name === "deposit");
  if (!depIx) throw new Error("IDL has no 'deposit' instruction");
  if (!program.coder?.instruction?.encode) throw new Error("Coder not initialized (bad Program ctor or IDL)");

  console.log("IDL deposit args:", depIx.args);
  console.log("IDL deposit accounts:", depIx.accounts.map((a: any) => a.name));

  const wallet = provider.wallet;
  const [vaultPda]  = PublicKey.findProgramAddressSync([Buffer.from("vault")], PROGRAM_ID);
  const [treePda]   = PublicKey.findProgramAddressSync([Buffer.from("tree")], PROGRAM_ID);
  const [configPda] = PublicKey.findProgramAddressSync([Buffer.from("config")], PROGRAM_ID);

  const nullifier = Math.floor(Math.random() * 2 ** 30);
  const secret = Math.floor(Math.random() * 2 ** 30);
  const commitment = simpleHash([nullifier, secret]);

  // ⚠️ Map these names EXACTLY to your IDL!
  // Replace keys below to match depIx.accounts order/names.
  const accounts: Record<string, PublicKey> = {
    // e.g. if IDL says "depositor": wallet.publicKey,
    // and "vault": vaultPda, "merkleTree": treePda, "config": configPda, etc.
    // Update these to match your actual IDL names:
    user: wallet.publicKey,
    config: configPda,
    merkleTree: treePda,
    vault: vaultPda,
    compressionProgram: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
    noopProgram: SPL_NOOP_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
  };

  console.log("📦 Accounts sent:", Object.fromEntries(Object.entries(accounts).map(([k,v])=>[k, v.toBase58()])));

  // If your deposit also transfers lamports to the vault, you either:
  // (a) do it inside the program (system_program::transfer), or
  // (b) add a pre-instruction here. Assuming (a) in your on-chain code.

  const sig = await program.methods.deposit(commitment as number[])
    .accounts(accounts)
    .rpc();

  console.log("✅ deposit tx:", sig);
}

main().catch((e) => {
  console.error("❌ Deposit failed:", e);
  process.exit(1);
});
