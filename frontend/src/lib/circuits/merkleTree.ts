import { poseidonHash } from './poseidon';

export interface MerkleProof {
  pathElements: string[];
  pathIndices: boolean[];
}

export class MerkleTreeClient {
  private depth: number;
  private zeroValue: bigint;
  private nodes: Map<string, bigint>;

  constructor(depth: number = 20) {
    this.depth = depth;
    this.zeroValue = BigInt(0);
    this.nodes = new Map();
  }

  async initialize() {
    await this.initializeZeroHashes();
  }

  private async initializeZeroHashes() {
    let currentHash = this.zeroValue;
    for (let i = 0; i < this.depth; i++) {
      const key = `${i}_0`;
      this.nodes.set(key, currentHash);
      currentHash = await poseidonHash([currentHash, currentHash]);
    }
  }

  private getNodeKey(level: number, index: number): string {
    return `${level}_${index}`;
  }

  private getNode(level: number, index: number): bigint {
    const key = this.getNodeKey(level, index);
    return this.nodes.get(key) || this.zeroValue;
  }

  private setNode(level: number, index: number, value: bigint) {
    const key = this.getNodeKey(level, index);
    this.nodes.set(key, value);
  }

  async insertLeaf(leafIndex: number, leafValue: bigint): Promise<bigint> {
    this.setNode(0, leafIndex, leafValue);

    let currentIndex = leafIndex;
    let currentValue = leafValue;

    for (let level = 0; level < this.depth; level++) {
      const isRightNode = currentIndex % 2 === 1;
      const siblingIndex = isRightNode ? currentIndex - 1 : currentIndex + 1;
      const siblingValue = this.getNode(level, siblingIndex);

      const parentValue = isRightNode 
        ? await poseidonHash([siblingValue, currentValue])
        : await poseidonHash([currentValue, siblingValue]);

      const parentIndex = Math.floor(currentIndex / 2);
      this.setNode(level + 1, parentIndex, parentValue);

      currentIndex = parentIndex;
      currentValue = parentValue;
    }

    return currentValue;
  }

  generateMerkleProof(leafIndex: number): MerkleProof {
    const pathElements: string[] = [];
    const pathIndices: boolean[] = [];

    let currentIndex = leafIndex;

    for (let level = 0; level < this.depth; level++) {
      const isRightNode = currentIndex % 2 === 1;
      const siblingIndex = isRightNode ? currentIndex - 1 : currentIndex + 1;
      const siblingValue = this.getNode(level, siblingIndex);

      pathElements.push(siblingValue.toString());
      pathIndices.push(isRightNode);

      currentIndex = Math.floor(currentIndex / 2);
    }

    return { pathElements, pathIndices };
  }

  getRoot(): bigint {
    return this.getNode(this.depth, 0);
  }

  async verifyMerkleProof(
    leaf: bigint,
    leafIndex: number,
    proof: MerkleProof
  ): Promise<boolean> {
    let currentHash = leaf;
    let currentIndex = leafIndex;

    for (let i = 0; i < this.depth; i++) {
      const pathElement = BigInt(proof.pathElements[i]);
      const isRightNode = proof.pathIndices[i];

      currentHash = isRightNode
        ? await poseidonHash([pathElement, currentHash])
        : await poseidonHash([currentHash, pathElement]);

      currentIndex = Math.floor(currentIndex / 2);
    }

    return currentHash === this.getRoot();
  }
}
