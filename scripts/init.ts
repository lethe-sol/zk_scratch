import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { TornadoMixer } from "../target/types/tornado_mixer";

const PROGRAM_ID = new PublicKey("2xBPdkCzfwFdc6khqbvaAvYxWcKMRaueXeVyaLRoWDrN");

const MAX_DEPTH = 20;  // Supports up to 2^20 = ~1M deposits
const MAX_BUFFER_SIZE = 64;  // Buffer for batching operations

async function initialize() {
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  
  const wallet = anchor.AnchorProvider.local().wallet;
  
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  const idl = await anchor.Program.fetchIdl(PROGRAM_ID, provider);
  const program = new anchor.Program(idl!, provider) as Program<TornadoMixer>;

  try {
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

    console.log("🚀 Initializing Tornado Mixer...");
    console.log("Program ID:", PROGRAM_ID.toString());
    console.log("Wallet:", wallet.publicKey.toString());
    console.log("Vault PDA:", vaultPda.toString());
    console.log("Merkle Tree PDA:", merkleTreePda.toString());
    console.log("Config PDA:", configPda.toString());
    console.log("Max Depth:", MAX_DEPTH);
    console.log("Max Buffer Size:", MAX_BUFFER_SIZE);

    const tx = await program.methods
      .initialize(MAX_DEPTH, MAX_BUFFER_SIZE)
      .accounts({
        payer: wallet.publicKey,
        vault: vaultPda,
        merkle_tree: merkleTreePda,
        config: configPda,
        system_program: SystemProgram.programId,
      })
      .rpc();

    console.log("✅ Initialization successful!");
    console.log("Transaction signature:", tx);
    
    const vaultAccount = await connection.getAccountInfo(vaultPda);
    const configAccount = await connection.getAccountInfo(configPda);
    const merkleTreeAccount = await connection.getAccountInfo(merkleTreePda);

    console.log("\n📊 Account Status:");
    console.log("Vault account created:", vaultAccount !== null);
    console.log("Config account created:", configAccount !== null);
    console.log("Merkle tree account created:", merkleTreeAccount !== null);

    if (vaultAccount) {
      console.log("Vault balance:", vaultAccount.lamports / 1e9, "SOL");
    }

  } catch (error) {
    console.error("❌ Initialization failed:", error);
    
    const vaultPda = PublicKey.findProgramAddressSync([Buffer.from("vault")], PROGRAM_ID)[0];
    const configPda = PublicKey.findProgramAddressSync([Buffer.from("config")], PROGRAM_ID)[0];
    
    const vaultExists = await connection.getAccountInfo(vaultPda);
    const configExists = await connection.getAccountInfo(configPda);
    
    if (vaultExists && configExists) {
      console.log("ℹ️  Program appears to already be initialized");
      console.log("Vault PDA:", vaultPda.toString());
      console.log("Config PDA:", configPda.toString());
    }
  }
}

initialize().catch(console.error);
