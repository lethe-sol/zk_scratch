use groth16_solana::groth16::Groth16Verifier;

// split 16B → 32B field element (big-endian)
fn be16_to_fe32(x: &[u8;16]) -> [u8;32] {
    let mut out = [0u8;32];
    out[16..].copy_from_slice(x);
    out
}

// marshal proof (same as you already do)
let proof_a: [u8; 64]  = proof[0..64].try_into().unwrap();
let proof_b: [u8;128]  = proof[64..192].try_into().unwrap();
let proof_c: [u8; 64]  = proof[192..256].try_into().unwrap();

// recipient halves → field elems
let rb = _recipient.to_bytes();
let mut hi = [0u8;16]; hi.copy_from_slice(&rb[0..16]);
let mut lo = [0u8;16]; lo.copy_from_slice(&rb[16..32]);

let public_inputs: [[u8;32]; 7] = [
    root,                      // 1
    nullifier_hash,            // 2
    be16_to_fe32(&hi),         // 3 recipient_1
    be16_to_fe32(&lo),         // 4 recipient_2
    [0u8;32],                  // 5 relayer_1 = 0 (for now)
    [0u8;32],                  // 6 relayer_2 = 0
    [0u8;32],                  // 7 fee = 0
];

let public_inputs_refs: Vec<&[u8;32]> = public_inputs.iter().collect();

let mut verifier = Groth16Verifier::new(
    &proof_a, &proof_b, &proof_c,
    public_inputs_refs.as_slice(),
    &VERIFYING_KEY,
).map_err(|_| MixerError::InvalidProof)?;
verifier.verify().map_err(|_| MixerError::InvalidProof)?;
