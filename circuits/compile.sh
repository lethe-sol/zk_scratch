#!/bin/bash
set -e

echo "🔧 Compiling Tornado Solana circuits..."

mkdir -p build

echo "📦 Installing dependencies..."
npm install

echo "🔨 Compiling withdraw circuit..."
circom withdraw.circom --r1cs --wasm --sym --c --O1 -o build/

echo "🔨 Compiling merkleTree circuit..."  
circom merkleTree.circom --r1cs --wasm --sym --c --O1 -o build/

echo "📊 Checking constraint counts..."
echo "Withdraw circuit:"
snarkjs r1cs info build/withdraw.r1cs

echo "MerkleTree circuit:"
snarkjs r1cs info build/merkleTree.r1cs

echo "✅ Compilation complete!"
echo "📁 Outputs in build/ directory:"
echo "  - withdraw.r1cs (constraint system)"
echo "  - withdraw.wasm (witness generator)"
echo "  - withdraw.sym (symbol table)"

echo ""
echo "🔄 Next steps:"
echo "1. Run parameter verification: npm run verify-params"
echo "2. Run circuit tests: npm run test"
echo "3. Generate trusted setup keys (see ../ceremony/README.md)"
