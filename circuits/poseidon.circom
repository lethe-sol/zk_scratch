include "node_modules/circomlib/circuits/poseidon.circom";

template PoseidonHasher(nInputs) {
    signal input inputs[nInputs];
    signal output out;
    
    if (nInputs == 1) {
        component hasher = Poseidon(1);
        hasher.inputs[0] <== inputs[0];
        out <== hasher.out;
    } else if (nInputs == 2) {
        component hasher = Poseidon(2);
        hasher.inputs[0] <== inputs[0];
        hasher.inputs[1] <== inputs[1];
        out <== hasher.out;
    }
}
