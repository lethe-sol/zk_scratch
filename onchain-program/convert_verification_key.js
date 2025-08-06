const fs = require('fs');

const vkPath = '../circuits/verification_key.json';
if (!fs.existsSync(vkPath)) {
    console.error('Verification key not found at:', vkPath);
    process.exit(1);
}

const vk = JSON.parse(fs.readFileSync(vkPath, 'utf8'));

const rustVk = {
    alpha: vk.vk_alpha_1,
    beta: vk.vk_beta_2,
    gamma: vk.vk_gamma_2,
    delta: vk.vk_delta_2,
    ic: vk.IC
};

console.log('Verification key converted to Rust format:');
console.log(JSON.stringify(rustVk, null, 2));

fs.writeFileSync('verification_key_rust.json', JSON.stringify(rustVk, null, 2));
console.log('Saved to verification_key_rust.json');
