const fs = require('fs');

const vkJson = JSON.parse(fs.readFileSync('../circuits/verification_key.json', 'utf8'));

function fieldToBytes(fieldStr) {
    const bigIntVal = BigInt(fieldStr);
    const bytes = new Array(32).fill(0);
    
    let temp = bigIntVal;
    for (let i = 0; i < 32; i++) {
        bytes[i] = Number(temp & 0xFFn);
        temp = temp >> 8n;
    }
    
    return bytes;
}

function g1ToBytes(point) {
    const x = fieldToBytes(point[0]);
    const y = fieldToBytes(point[1]);
    return [...x, ...y];
}

function g2ToBytes(point) {
    const x1 = fieldToBytes(point[0][0]);
    const x2 = fieldToBytes(point[0][1]);
    const y1 = fieldToBytes(point[1][0]);
    const y2 = fieldToBytes(point[1][1]);
    return [...x1, ...x2, ...y1, ...y2];
}

const alpha = g1ToBytes(vkJson.vk_alpha_1);
const beta = g2ToBytes(vkJson.vk_beta_2);
const gamma = g2ToBytes(vkJson.vk_gamma_2);
const delta = g2ToBytes(vkJson.vk_delta_2);

const ic = [];
for (const icPoint of vkJson.IC) {
    ic.push(...g1ToBytes(icPoint));
}

const vkBytes = [
    ...alpha,    // 64 bytes
    ...beta,     // 128 bytes  
    ...gamma,    // 128 bytes
    ...delta,    // 128 bytes
    ...ic        // 64 * IC.length bytes
];

const rustCode = `// Auto-generated verifying key from circuits/verification_key.json
use groth16_solana::groth16::Groth16Verifyingkey;

pub const VK_ALPHA_G1: [u8; 64] = [${alpha.map((b, i) => {
    if (i % 16 === 0) return `\n    ${b}`;
    return `${b}`;
}).join(', ')}
];

pub const VK_BETA_G2: [u8; 128] = [${beta.map((b, i) => {
    if (i % 16 === 0) return `\n    ${b}`;
    return `${b}`;
}).join(', ')}
];

pub const VK_GAMMA_G2: [u8; 128] = [${gamma.map((b, i) => {
    if (i % 16 === 0) return `\n    ${b}`;
    return `${b}`;
}).join(', ')}
];

pub const VK_DELTA_G2: [u8; 128] = [${delta.map((b, i) => {
    if (i % 16 === 0) return `\n    ${b}`;
    return `${b}`;
}).join(', ')}
];

pub const VK_IC: [[u8; 64]; ${vkJson.IC.length}] = [${vkJson.IC.map((icPoint, idx) => {
    const icBytes = g1ToBytes(icPoint);
    return `\n    [${icBytes.map((b, i) => {
        if (i % 16 === 0) return `\n        ${b}`;
        return `${b}`;
    }).join(', ')}\n    ]`;
}).join(',')}
];

pub const NR_PUBINPUTS: usize = ${vkJson.nPublic};

pub fn get_verifying_key() -> Groth16Verifyingkey<'static> {
    Groth16Verifyingkey {
        nr_pubinputs: NR_PUBINPUTS,
        vk_alpha_g1: VK_ALPHA_G1,
        vk_beta_g2: VK_BETA_G2,
        vk_gamme_g2: VK_GAMMA_G2,
        vk_delta_g2: VK_DELTA_G2,
        vk_ic: &VK_IC,
    }
}
`;

fs.writeFileSync('src/verifying_key.rs', rustCode);

console.log(`Converted verifying key to ${vkBytes.length} bytes`);
console.log(`IC points: ${vkJson.IC.length}`);
console.log('Generated src/verifying_key.rs');
