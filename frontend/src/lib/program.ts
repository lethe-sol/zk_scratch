import * as anchor from '@coral-xyz/anchor';
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { AnchorWallet } from '@solana/wallet-adapter-react';
import idl from './tornado_solana.json';

export const PROGRAM_ID = new PublicKey('wFafLjoy9oEs8jqWC65kDMB4MdpBCoT5imbqsddqFJJ');
export const RPC_URL = 'https://api.devnet.solana.com';

export function getProgram(wallet: AnchorWallet) {
  const connection = new Connection(RPC_URL, 'confirmed');
  const provider = new AnchorProvider(connection, wallet, {
    commitment: 'confirmed',
  });
  
  return new Program(idl as any, provider);
}

export const DUMMY_COMMITMENT = Array.from(new Uint8Array(32).fill(1));
export const DUMMY_NULLIFIER_HASH = Array.from(new Uint8Array(32).fill(2));
export const DUMMY_RECIPIENT = new PublicKey('11111111111111111111111111111112');
export const DUMMY_RELAYER = new PublicKey('11111111111111111111111111111112');
export const DUMMY_FEE = new anchor.BN(0);

export const DUMMY_PROOF = {
  pi_a: [
    Array.from(new Uint8Array(32).fill(3)),
    Array.from(new Uint8Array(32).fill(4))
  ],
  pi_b: [
    [Array.from(new Uint8Array(32).fill(5)), Array.from(new Uint8Array(32).fill(6))],
    [Array.from(new Uint8Array(32).fill(7)), Array.from(new Uint8Array(32).fill(8))]
  ],
  pi_c: [
    Array.from(new Uint8Array(32).fill(9)),
    Array.from(new Uint8Array(32).fill(10))
  ]
};

export const DUMMY_MERKLE_PROOF = Array(20).fill(Array.from(new Uint8Array(32).fill(11)));
export const DUMMY_PATH_INDICES = Array(20).fill(0);

export const DEPOSIT_AMOUNT = 0.1 * LAMPORTS_PER_SOL; // 0.1 SOL in lamports
