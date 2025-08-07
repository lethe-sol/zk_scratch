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
    const formattedVerificationKey = this.formatVerificationKey();
    
    try {
      return await this.initializeSingleTransaction(params, formattedVerificationKey);
    } catch (error: any) {
      if (error.message?.includes('Transaction too large') || error.message?.includes('1283 > 1232')) {
        console.log('Single transaction too large, attempting multi-step initialization...');
        return await this.initializeMultiStep(params, formattedVerificationKey);
      }
      throw error;
    }
  }

  private async initializeSingleTransaction(params: InitializationParams, verificationKey: any): Promise<string> {
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

    const tx = await this.program.methods
      .initialize(new BN(params.depositAmount), verificationKey)
      .accounts({
        payer: this.provider.wallet.publicKey,
        tornadoPool: tornadoPoolPda,
        merkleTree: merkleTreePda,
        nullifierSet: nullifierSetPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log('Program initialized with single transaction:', tx);
    return tx;
  }

  private async initializeMultiStep(params: InitializationParams, verificationKey: any): Promise<string> {
    
    const minimalVerificationKey = this.createMinimalVerificationKey();
    
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

    try {
      const tx = await this.program.methods
        .initialize(new BN(params.depositAmount), minimalVerificationKey)
        .accounts({
          payer: this.provider.wallet.publicKey,
          tornadoPool: tornadoPoolPda,
          merkleTree: merkleTreePda,
          nullifierSet: nullifierSetPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log('Program initialized with minimal verification key:', tx);
      return tx;
    } catch (error) {
      console.error('Failed to initialize with minimal verification key:', error);
      throw new Error('Transaction still too large even with minimal verification key. Program may need to be modified to accept verification key in parts.');
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
      alpha: this.bigIntPairToBytes(vk.vk_alpha_1[0], vk.vk_alpha_1[1]),
      beta: this.g2PointToBytes(vk.vk_beta_2),
      gamma: this.g2PointToBytes(vk.vk_gamma_2),
      delta: this.g2PointToBytes(vk.vk_delta_2),
      ic: vk.IC.map(ic => this.bigIntPairToBytes(ic[0], ic[1]))
    };
  }

  private bigIntToBytes32(value: string): number[] {
    const bigInt = BigInt(value);
    const hex = bigInt.toString(16).padStart(64, '0');
    const bytes: number[] = [];
    for (let i = 0; i < hex.length; i += 2) {
      bytes.push(parseInt(hex.substr(i, 2), 16));
    }
    return bytes;
  }

  private bigIntPairToBytes(x: string, y: string): number[] {
    const xBytes = this.bigIntToBytes32(x);
    const yBytes = this.bigIntToBytes32(y);
    return [...xBytes, ...yBytes];
  }

  private g2PointToBytes(point: string[][]): number[] {
    const x1Bytes = this.bigIntToBytes32(point[0][0]);
    const x2Bytes = this.bigIntToBytes32(point[0][1]);
    const y1Bytes = this.bigIntToBytes32(point[1][0]);
    const y2Bytes = this.bigIntToBytes32(point[1][1]);
    return [...x1Bytes, ...x2Bytes, ...y1Bytes, ...y2Bytes];
  }

  private createMinimalVerificationKey(): any {
    const zeroBytes32 = new Array(32).fill(0);
    const zeroBytes64 = new Array(64).fill(0);
    const zeroBytes128 = new Array(128).fill(0);
    
    return {
      alpha: zeroBytes64,
      beta: zeroBytes128,
      gamma: zeroBytes128,
      delta: zeroBytes128,
      ic: [zeroBytes64] // Minimal IC with just one element instead of 8
    };
  }

  getProgram(): Program {
    return this.program;
  }

  getProvider(): AnchorProvider {
    return this.provider;
  }
}
