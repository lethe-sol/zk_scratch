include "./merkleTree.circom";
include "./poseidon.circom";

// computes Poseidon(nullifier, secret) using Light Protocol implementation
template CommitmentHasher() {
    signal input nullifier;
    signal input secret;
    signal output commitment;
    signal output nullifierHash;

    component commitmentHasher = PoseidonHasher(2);
    commitmentHasher.inputs[0] <== nullifier;
    commitmentHasher.inputs[1] <== secret;
    commitment <== commitmentHasher.out;

    component nullifierHasher = PoseidonHasher(1);
    nullifierHasher.inputs[0] <== nullifier;
    nullifierHash <== nullifierHasher.out;
}

// Verifies that commitment that corresponds to given secret and nullifier is included in the merkle tree of deposits
template Withdraw(levels) {
    // Public inputs (verified on-chain by Light Protocol Groth16 verifier)
    signal input root;
    signal input nullifierHash;
    signal input recipient_1; // First half of Solana pubkey (32 bytes split into 2 field elements)
    signal input recipient_2; // Second half of Solana pubkey
    signal input relayer_1;   // First half of relayer pubkey (kept for future extensibility)
    signal input relayer_2;   // Second half of relayer pubkey
    signal input fee;         // Relayer fee in lamports

    // Private inputs (hidden in proof)
    signal private input nullifier;
    signal private input secret;
    signal private input pathElements[levels];
    signal private input pathIndices[levels];

    component hasher = CommitmentHasher();
    hasher.nullifier <== nullifier;
    hasher.secret <== secret;
    hasher.nullifierHash === nullifierHash;

    component tree = MerkleTreeChecker(levels);
    tree.leaf <== hasher.commitment;
    tree.root <== root;
    for (var i = 0; i < levels; i++) {
        tree.pathElements[i] <== pathElements[i];
        tree.pathIndices[i] <== pathIndices[i];
    }

    // Add hidden signals to make sure that tampering with recipient or fee will invalidate the snark proof
    // Squares are used to prevent optimizer from removing those constraints
    signal recipient1Square;
    signal recipient2Square;
    signal relayer1Square;
    signal relayer2Square;
    signal feeSquare;
    recipient1Square <== recipient_1 * recipient_1;
    recipient2Square <== recipient_2 * recipient_2;
    relayer1Square <== relayer_1 * relayer_1;
    relayer2Square <== relayer_2 * relayer_2;
    feeSquare <== fee * fee;
}

component main = Withdraw(20);
