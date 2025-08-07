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
      console.log('Starting multi-step initialization...');
      
      const vkTx = await this.initializeVerificationKey(formattedVerificationKey);
      console.log('Verification key account created:', vkTx);
      
      const [verificationKeyPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('verification_key')],
        this.program.programId
      );
      const poolTx = await this.initializePool(params.depositAmount, verificationKeyPda);
      console.log('Pool account created:', poolTx);
      
      const treeTx = await this.initializeMerkleTree();
      console.log('Merkle tree account created:', treeTx);
      
      const nullifierTx = await this.initializeNullifierSet();
      console.log('Nullifier set account created:', nullifierTx);
      
      return `Multi-step initialization completed. Final tx: ${nullifierTx}`;
    } catch (error: any) {
      console.error('Multi-step initialization failed:', error);
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

  private async initializeVerificationKey(verificationKey: any): Promise<string> {
    const [verificationKeyPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('verification_key')],
      this.program.programId
    );

    return await this.program.methods
      .initializeVerificationKey(verificationKey)
      .accounts({
        payer: this.provider.wallet.publicKey,
        verificationKeyAccount: verificationKeyPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  private async initializePool(depositAmount: number, verificationKeyAccount: PublicKey): Promise<string> {
    const [tornadoPoolPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('tornado_pool')],
      this.program.programId
    );

    return await this.program.methods
      .initializePool(new BN(depositAmount), verificationKeyAccount)
      .accounts({
        payer: this.provider.wallet.publicKey,
        tornadoPool: tornadoPoolPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  private async initializeMerkleTree(): Promise<string> {
    const [merkleTreePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('merkle_tree')],
      this.program.programId
    );

    return await this.program.methods
      .initializeMerkleTree()
      .accounts({
        payer: this.provider.wallet.publicKey,
        merkleTree: merkleTreePda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  private async initializeNullifierSet(): Promise<string> {
    const [nullifierSetPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('nullifier_set')],
      this.program.programId
    );

    return await this.program.methods
      .initializeNullifierSet()
      .accounts({
        payer: this.provider.wallet.publicKey,
        nullifierSet: nullifierSetPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
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
    const zeroBytes64 = new Array(64).fill(0);
    const zeroBytes128 = new Array(128).fill(0);
    
    const icElements = [];
    for (let i = 0; i < 8; i++) {
      icElements.push([...zeroBytes64]);
    }
    
    return {
      alpha: [...zeroBytes64],
      beta: [...zeroBytes128],
      gamma: [...zeroBytes128],
      delta: [...zeroBytes128],
      ic: icElements
    };
  }

  getProgram(): Program {
    return this.program;
  }

  getProvider(): AnchorProvider {
    return this.provider;
  }
}
