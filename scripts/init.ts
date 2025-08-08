import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import idl from "../target/idl/tornado_mixer.json";
import { TornadoMixer } from "../target/types/tornado_mixer";

const PROGRAM_ID = new PublicKey("2xBPdkCzfwFdc6khqbvaAvYxWcKMRaueXeVyaLRoWDrN");

const MAX_DEPTH = 20;       // supported depth for your tree
const MAX_BUFFER_SIZE = 64; // supported queue size

async function initialize() {
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  const provider = new anchor.AnchorProvider(connection, anchor.AnchorProvider.local().wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  // Build a typed Program client from the local IDL (bypasses bad on-chain IDL)
  const program = new Program<TornadoMixer>(idl as any, PROGRAM_ID, provider);

  // PDAs
  const [vaultPda]      = PublicKey.findProgramAddressSync([Buffer.from("vault")], PROGRAM_ID);
  const [merkleTreePda] = PublicKey.findProgramAddressSync([Buffer.from("tree")],  PROGRAM_ID);
  const [configPda]     = PublicKey.findProgramAddressSync([Buffer.from("config")], PROGRAM_ID);

  console.log("Program ID:", PROGRAM_ID.toBase58());
  console.log("Payer:", provider.wallet.publicKey.toBase58());
  console.log("Vault PDA:", vaultPda.toBase58());
  console.log("Tree PDA:", merkleTreePda.toBase58());
  console.log("Config PDA:", configPda.toBase58());

  try {
    const tx = await program.methods
      .initialize(new anchor.BN(MAX_DEPTH), new anchor.BN(MAX_BUFFER_SIZE))
      .accounts({
        payer: provider.wallet.publicKey,
        vault: vaultPda,
        merkleTree: merkleTreePda,      // <- camelCase
        config: configPda,
        systemProgram: SystemProgram.programId, // <- camelCase
      })
      .rpc();

    console.log("✅ initialize tx:", tx);

    const vaultInfo = await connection.getAccountInfo(vaultPda);
    const treeInfo  = await connection.getAccountInfo(merkleTreePda);
    const cfgInfo   = await connection.getAccountInfo(configPda);
    console.log("Vault created:", !!vaultInfo);
    console.log("Tree created:",  !!treeInfo);
    console.log("Config created:",!!cfgInfo);
    if (vaultInfo) console.log("Vault balance:", vaultInfo.lamports / 1e9, "SOL");
  } catch (e) {
    console.error("❌ Initialization failed:", e);
  }
}

initialize().catch(console.error);
