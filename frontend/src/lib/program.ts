import * as anchor from '@coral-xyz/anchor';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import { Connection, PublicKey, LAMPORTS_PER_SOL, SystemProgram } from '@solana/web3.js';
import { AnchorWallet } from '@solana/wallet-adapter-react';
import idl from './tornado_solana.json';
import { NoteManager, TornadoNote } from './circuits/noteManager';
import { ProofGenerator } from './circuits/proofGeneration';
import { MockProofGenerator } from './circuits/mockProofGeneration';
import { MerkleTreeClient } from './circuits/merkleTree';
import { ProgramInitializer } from './circuits/programInitialization';
import { generateCommitment, bigIntToBytes32 } from './circuits/poseidon';

export const PROGRAM_ID = new PublicKey('wFafLjoy9oEs8jqWC65kDMB4MdpBCoT5imbqsddqFJJ');
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://api.devnet.solana.com';
export let DUMMY_MODE = false;

export function getProgram(wallet: AnchorWallet) {
  const connection = new Connection(RPC_URL, 'confirmed');
  const provider = new AnchorProvider(connection, wallet, {
    commitment: 'confirmed',
  });
  
  return new Program(idl as any, provider);
}

export const DEPOSIT_AMOUNT = 0.1 * LAMPORTS_PER_SOL; // 0.1 SOL in lamports

let merkleTreeClient: MerkleTreeClient | null = null;
let proofGenerator: ProofGenerator | null = null;

export async function getMerkleTreeClient(): Promise<MerkleTreeClient> {
  if (!merkleTreeClient) {
    merkleTreeClient = new MerkleTreeClient(20);
    await merkleTreeClient.initialize();
  }
  return merkleTreeClient;
}

export function getProofGenerator(): ProofGenerator | MockProofGenerator {
  if (!proofGenerator) {
    if (DUMMY_MODE) {
      proofGenerator = new MockProofGenerator() as any;
    } else {
      proofGenerator = new ProofGenerator();
    }
  }
  return proofGenerator;
}

export function setDummyMode(enabled: boolean) {
  DUMMY_MODE = enabled;
  proofGenerator = null;
}

export async function initializeProgram(wallet: AnchorWallet): Promise<string> {
  const connection = new Connection(RPC_URL, 'confirmed');
  const initializer = new ProgramInitializer(wallet, connection);
  
  const isInitialized = await initializer.checkIfInitialized();
  if (isInitialized) {
    throw new Error('Program is already initialized');
  }
  
  return await initializer.initializeProgram({
    depositAmount: DEPOSIT_AMOUNT
  });
}

export async function deposit(wallet: AnchorWallet): Promise<{ tx: string; note: TornadoNote }> {
  const program = getProgram(wallet);
  const merkleTree = await getMerkleTreeClient();
  
  const note = await NoteManager.generateNote(DEPOSIT_AMOUNT);
  
  const commitment = await generateCommitment(note.nullifier, note.secret);
  const commitmentBytes = Array.from(bigIntToBytes32(commitment));
  
  const [tornadoPoolPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('tornado_pool')],
    program.programId
  );
  
  const poolInfo = await program.account['tornadoPool'].fetch(tornadoPoolPda);
  const leafIndex = poolInfo.depositCount.toNumber();
  
  await merkleTree.insertLeaf(leafIndex, commitment);
  
  const tx = await program.methods
    .deposit(commitmentBytes)
    .accounts({
      depositor: wallet.publicKey,
    })
    .rpc();
  
  NoteManager.saveNote(note);
  
  return { tx, note };
}

export async function withdraw(
  wallet: AnchorWallet, 
  noteString: string, 
  recipient: PublicKey
): Promise<string> {
  const program = getProgram(wallet);
  const merkleTree = await getMerkleTreeClient();
  const proofGen = getProofGenerator();
  
  const note = await NoteManager.parseNoteString(noteString);
  if (!note) {
    throw new Error('Invalid note format');
  }
  
  if (!NoteManager.validateNote(note)) {
    throw new Error('Invalid note - commitment mismatch');
  }
  
  const [merkleTreePda] = PublicKey.findProgramAddressSync(
    [Buffer.from('merkle_tree')],
    program.programId
  );
  
  const treeInfo = await program.account['merkleTree'].fetch(merkleTreePda);
  const currentRoot = treeInfo.root;
  
  const leafIndex = 0;
  const commitment = await generateCommitment(note.nullifier, note.secret);
  
  await merkleTree.insertLeaf(leafIndex, commitment);
  const merkleProof = merkleTree.generateMerkleProof(leafIndex);
  
  const { proof, publicInputs } = await proofGen.generateWithdrawProof(
    note.nullifier,
    note.secret,
    recipient.toBase58(),
    '11111111111111111111111111111111', // Default relayer
    '0', // No fee
    merkleProof,
    currentRoot.toString()
  );
  
  const tx = await program.methods
    .withdraw(
      Array.from(proof.proof_a),
      Array.from(proof.proof_b),
      Array.from(proof.proof_c),
      publicInputs,
      merkleProof.pathElements.map(elem => Array.from(bigIntToBytes32(BigInt(elem)))),
      merkleProof.pathIndices
    )
    .accounts({
      withdrawer: wallet.publicKey,
      recipient: recipient,
    })
    .rpc();
    
  return tx;
}
