import { buildPoseidon } from 'circomlibjs';

let poseidonInstance: any = null;

async function getPoseidon() {
  if (!poseidonInstance) {
    poseidonInstance = await buildPoseidon();
  }
  return poseidonInstance;
}

export async function poseidonHash(inputs: (string | number | bigint)[]): Promise<bigint> {
  const bigIntInputs = inputs.map(input => {
    if (typeof input === 'string') {
      return BigInt(input);
    } else if (typeof input === 'number') {
      return BigInt(input);
    }
    return input;
  });
  
  const poseidon = await getPoseidon();
  return poseidon(bigIntInputs);
}

export async function generateCommitment(nullifier: string, secret: string): Promise<bigint> {
  return await poseidonHash([nullifier, secret]);
}

export async function generateNullifierHash(nullifier: string): Promise<bigint> {
  return await poseidonHash([nullifier]);
}

export function bigIntToBytes32(value: bigint): Uint8Array {
  const hex = value.toString(16).padStart(64, '0');
  return new Uint8Array(Buffer.from(hex, 'hex'));
}

export function bytes32ToBigInt(bytes: Uint8Array): bigint {
  return BigInt('0x' + Buffer.from(bytes).toString('hex'));
}

export function splitPubkeyForCircuit(pubkey: string): { part1: bigint; part2: bigint } {
  const bytes = Buffer.from(pubkey, 'base64');
  const part1Bytes = bytes.slice(0, 16);
  const part2Bytes = bytes.slice(16, 32);
  
  const part1 = BigInt('0x' + part1Bytes.toString('hex'));
  const part2 = BigInt('0x' + part2Bytes.toString('hex'));
  
  return { part1, part2 };
}
