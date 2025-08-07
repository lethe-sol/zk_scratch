import { bigIntToBytes32 } from './poseidon';
import { MerkleProof } from './merkleTree';

export interface FormattedProof {
  proof_a: Uint8Array;
  proof_b: Uint8Array;
  proof_c: Uint8Array;
}

export class MockProofGenerator {
  async generateWithdrawProof(
    nullifier: string,
    secret: string,
    recipient: string,
    relayer: string = '11111111111111111111111111111111',
    fee: string = '0',
    merkleProof: MerkleProof,
    root: string
  ): Promise<{ proof: FormattedProof; publicInputs: any }> {
    
    const fakeProof: FormattedProof = {
      proof_a: new Uint8Array(64).fill(1),
      proof_b: new Uint8Array(128).fill(2),
      proof_c: new Uint8Array(64).fill(3),
    };

    const publicInputs = {
      root: Array.from(bigIntToBytes32(BigInt(root))),
      nullifier_hash: Array.from(bigIntToBytes32(BigInt('0x' + nullifier))),
      recipient_1: Array.from(bigIntToBytes32(BigInt('0x' + recipient.slice(0, 32)))),
      recipient_2: Array.from(bigIntToBytes32(BigInt('0x' + recipient.slice(32, 64)))),
      relayer_1: Array.from(bigIntToBytes32(BigInt('0x' + relayer.slice(0, 32)))),
      relayer_2: Array.from(bigIntToBytes32(BigInt('0x' + relayer.slice(32, 64)))),
      fee: Array.from(bigIntToBytes32(BigInt(fee)))
    };

    return { proof: fakeProof, publicInputs };
  }
}
