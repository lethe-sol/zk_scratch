import { Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { AnchorProvider, Program, BN } from '@coral-xyz/anchor';
import { AnchorWallet } from '@solana/wallet-adapter-react';
import idl from '../tornado_solana.json';
import verificationKey from '../../../../circuits/verification_key.json';

export interface InitializationParams {
  depositAmount: number;
}

export class ProgramInitializer {
  private program: Program;
  private provider: AnchorProvider;

  constructor(wallet: AnchorWallet, connection: Connection) {
    this.provider = new AnchorProvider(connection, wallet, {});
    this.program = new Program(idl as any, this.provider);
  }

  async initializeProgram(params: InitializationParams): Promise<string> {
    const [tornadoPoolPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('tornado_pool')],
      this.program.programId
    );

    const [merkleTreePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('merkle_tree')],
      this.program.programId
    );

    const [nullifierSetPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('nullifier_set')],
      this.program.programId
    );

    const formattedVerificationKey = this.formatVerificationKey();

    try {
      const tx = await this.program.methods
        .initialize(new BN(params.depositAmount), formattedVerificationKey)
        .accounts({
          payer: this.provider.wallet.publicKey,
          tornadoPool: tornadoPoolPda,
          merkleTree: merkleTreePda,
          nullifierSet: nullifierSetPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log('Program initialized with transaction:', tx);
      return tx;
    } catch (error) {
      console.error('Failed to initialize program:', error);
      throw error;
    }
  }

  async checkIfInitialized(): Promise<boolean> {
    try {
      const [tornadoPoolPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('tornado_pool')],
        this.program.programId
      );

      const account = await this.program.account['tornadoPool'].fetch(tornadoPoolPda);
      return !!account;
    } catch (error) {
      return false;
    }
  }

  async getTornadoPoolInfo(): Promise<any> {
    const [tornadoPoolPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('tornado_pool')],
      this.program.programId
    );

    return await this.program.account['tornadoPool'].fetch(tornadoPoolPda);
  }

  async getMerkleTreeInfo(): Promise<any> {
    const [merkleTreePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('merkle_tree')],
      this.program.programId
    );

    return await this.program.account['merkleTree'].fetch(merkleTreePda);
  }

  async getNullifierSetInfo(): Promise<any> {
    const [nullifierSetPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('nullifier_set')],
      this.program.programId
    );

    return await this.program.account['nullifierSet'].fetch(nullifierSetPda);
  }

  private formatVerificationKey(): any {
    const vk = verificationKey;
    
    return {
      alpha: this.hexToBytes(vk.vk_alpha_1[0] + vk.vk_alpha_1[1], 64),
      beta: this.hexToBytes(
        vk.vk_beta_2[0][1] + vk.vk_beta_2[0][0] + vk.vk_beta_2[1][1] + vk.vk_beta_2[1][0], 
        128
      ),
      gamma: this.hexToBytes(
        vk.vk_gamma_2[0][1] + vk.vk_gamma_2[0][0] + vk.vk_gamma_2[1][1] + vk.vk_gamma_2[1][0], 
        128
      ),
      delta: this.hexToBytes(
        vk.vk_delta_2[0][1] + vk.vk_delta_2[0][0] + vk.vk_delta_2[1][1] + vk.vk_delta_2[1][0], 
        128
      ),
      ic: vk.IC.map(ic => this.hexToBytes(ic[0] + ic[1], 64))
    };
  }

  private hexToBytes(hex: string, expectedLength: number): number[] {
    const cleanHex = hex.replace('0x', '');
    const padded = cleanHex.padStart(expectedLength * 2, '0');
    const bytes: number[] = [];
    for (let i = 0; i < padded.length; i += 2) {
      bytes.push(parseInt(padded.substr(i, 2), 16));
    }
    return bytes;
  }

  getProgram(): Program {
    return this.program;
  }

  getProvider(): AnchorProvider {
    return this.provider;
  }
}
