const snarkjs = require('snarkjs');
import { generateCommitment, generateNullifierHash, bigIntToBytes32, splitPubkeyForCircuit } from './poseidon';
import { MerkleTreeClient, MerkleProof } from './merkleTree';

export interface WithdrawInput {
  root: string;
  nullifierHash: string;
  recipient_1: string;
  recipient_2: string;
  relayer_1: string;
  relayer_2: string;
  fee: string;
  nullifier: string;
  secret: string;
  pathElements: string[];
  pathIndices: number[];
}

export interface Groth16Proof {
  pi_a: [string, string];
  pi_b: [[string, string], [string, string]];
  pi_c: [string, string];
  protocol: string;
  curve: string;
}

export interface FormattedProof {
  proof_a: Uint8Array;
  proof_b: Uint8Array;
  proof_c: Uint8Array;
}

export class ProofGenerator {
  private wasmPath: string;
  private zkeyPath: string;

  constructor() {
    this.wasmPath = '/circuits/withdraw.wasm';
    this.zkeyPath = '/circuits/withdraw_final.zkey';
  }

  async generateWithdrawProof(
    nullifier: string,
    secret: string,
    recipient: string,
    relayer: string = '11111111111111111111111111111111',
    fee: string = '0',
    merkleProof: MerkleProof,
    root: string
  ): Promise<{ proof: FormattedProof; publicInputs: any }> {
    const commitment = generateCommitment(nullifier, secret);
    const nullifierHash = generateNullifierHash(nullifier);
    
    const recipientSplit = splitPubkeyForCircuit(recipient);
    const relayerSplit = splitPubkeyForCircuit(relayer);

    const input: WithdrawInput = {
      root,
      nullifierHash: nullifierHash.toString(),
      recipient_1: recipientSplit.part1.toString(),
      recipient_2: recipientSplit.part2.toString(),
      relayer_1: relayerSplit.part1.toString(),
      relayer_2: relayerSplit.part2.toString(),
      fee,
      nullifier,
      secret,
      pathElements: merkleProof.pathElements,
      pathIndices: merkleProof.pathIndices.map(x => x ? 1 : 0)
    };

    try {
      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        input,
        this.wasmPath,
        this.zkeyPath
      );

      const formattedProof = this.formatProofForSolana(proof);
      
      const publicInputs = {
        root: bigIntToBytes32(BigInt(publicSignals[0])),
        nullifier_hash: bigIntToBytes32(BigInt(publicSignals[1])),
        recipient_1: bigIntToBytes32(BigInt(publicSignals[2])),
        recipient_2: bigIntToBytes32(BigInt(publicSignals[3])),
        relayer_1: bigIntToBytes32(BigInt(publicSignals[4])),
        relayer_2: bigIntToBytes32(BigInt(publicSignals[5])),
        fee: bigIntToBytes32(BigInt(publicSignals[6]))
      };

      return { proof: formattedProof, publicInputs };
    } catch (error) {
      console.error('Proof generation failed:', error);
      throw new Error(`Failed to generate proof: ${error}`);
    }
  }

  private formatProofForSolana(proof: Groth16Proof): FormattedProof {
    const proof_a = this.g1PointToBytes(proof.pi_a);
    const proof_b = this.g2PointToBytes(proof.pi_b);
    const proof_c = this.g1PointToBytes(proof.pi_c);

    return {
      proof_a: new Uint8Array(proof_a),
      proof_b: new Uint8Array(proof_b),
      proof_c: new Uint8Array(proof_c)
    };
  }

  private g1PointToBytes(point: [string, string]): number[] {
    const x = BigInt(point[0]);
    const y = BigInt(point[1]);
    
    const xBytes = this.bigIntToBytes32Array(x);
    const yBytes = this.bigIntToBytes32Array(y);
    
    return [...xBytes, ...yBytes];
  }

  private g2PointToBytes(point: [[string, string], [string, string]]): number[] {
    const x1 = BigInt(point[0][0]);
    const x2 = BigInt(point[0][1]);
    const y1 = BigInt(point[1][0]);
    const y2 = BigInt(point[1][1]);
    
    const x1Bytes = this.bigIntToBytes32Array(x1);
    const x2Bytes = this.bigIntToBytes32Array(x2);
    const y1Bytes = this.bigIntToBytes32Array(y1);
    const y2Bytes = this.bigIntToBytes32Array(y2);
    
    return [...x1Bytes, ...x2Bytes, ...y1Bytes, ...y2Bytes];
  }

  private bigIntToBytes32Array(value: bigint): number[] {
    const hex = value.toString(16).padStart(64, '0');
    const bytes: number[] = [];
    for (let i = 0; i < hex.length; i += 2) {
      bytes.push(parseInt(hex.substr(i, 2), 16));
    }
    return bytes;
  }
}
