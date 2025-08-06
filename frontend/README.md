# Frontend - Implementation Guide

## Overview

The frontend provides a user-friendly interface for depositing SOL, generating note strings, and creating ZK proofs for anonymous withdrawals.

## Frontend Architecture

### Technology Stack
```
frontend/
├── src/
│   ├── components/         # React components
│   ├── hooks/             # Custom React hooks
│   ├── utils/             # Utility functions
│   ├── workers/           # Web workers for ZK proving
│   ├── types/             # TypeScript type definitions
│   └── App.tsx            # Main application
├── public/
│   ├── withdraw.wasm      # Compiled circuit WASM
│   ├── withdraw.zkey      # Proving key from ceremony
│   └── verification_key.json # Verifying key (for validation)
├── package.json           # Dependencies
└── vite.config.ts        # Vite configuration
```

## Step-by-Step Implementation

### Step 1: Project Setup (Day 1)

**Initialize React Project**:
```bash
cd frontend/
npm create vite@latest . -- --template react-ts
npm install

# Install Solana and ZK dependencies
npm install @solana/web3.js @solana/wallet-adapter-react @solana/wallet-adapter-wallets
npm install @coral-xyz/anchor
npm install snarkjs circomlib
npm install @lightprotocol/light-poseidon

# Install UI dependencies
npm install @headlessui/react @heroicons/react
npm install tailwindcss @tailwindcss/forms
```

**Configure Tailwind CSS**:
```bash
npx tailwindcss init -p
```

**Update tailwind.config.js**:
```javascript
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}
```

### Step 2: Solana Integration (Day 1-2)

**Create utils/solana.ts**:
```typescript
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { AnchorProvider, Program, Idl } from '@coral-xyz/anchor';
import { WalletContextState } from '@solana/wallet-adapter-react';

// Import generated IDL from Solana program
import TornadoIDL from './tornado.json';

export const PROGRAM_ID = new PublicKey('TornadoXYZ...'); // From deployment
export const TORNADO_STATE_SEED = 'tornado_state';

export class TornadoProgram {
  private connection: Connection;
  private provider: AnchorProvider;
  private program: Program;

  constructor(connection: Connection, wallet: WalletContextState) {
    this.connection = connection;
    this.provider = new AnchorProvider(connection, wallet as any, {});
    this.program = new Program(TornadoIDL as Idl, PROGRAM_ID, this.provider);
  }

  // Get tornado state PDA
  getTornadoStatePDA(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(TORNADO_STATE_SEED)],
      PROGRAM_ID
    );
  }

  // Deposit SOL into mixer
  async deposit(commitment: Uint8Array): Promise<string> {
    const [tornadoState] = this.getTornadoStatePDA();
    
    const tx = await this.program.methods
      .deposit(Array.from(commitment))
      .accounts({
        depositor: this.provider.wallet.publicKey,
        tornadoState,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return tx;
  }

  // Withdraw SOL from mixer
  async withdraw(
    proof: Uint8Array,
    root: Uint8Array,
    nullifierHash: Uint8Array,
    recipient: PublicKey,
    relayer: PublicKey,
    fee: number
  ): Promise<string> {
    const [tornadoState] = this.getTornadoStatePDA();

    const tx = await this.program.methods
      .withdraw(
        Array.from(proof),
        Array.from(root),
        Array.from(nullifierHash),
        recipient,
        relayer,
        fee
      )
      .accounts({
        recipient,
        relayer,
        tornadoState,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return tx;
  }

  // Get current tornado state
  async getTornadoState() {
    const [tornadoState] = this.getTornadoStatePDA();
    return await this.program.account.tornadoState.fetch(tornadoState);
  }
}
```

### Step 3: ZK Proof Generation (Day 2-3)

**Create utils/zkProof.ts**:
```typescript
import * as snarkjs from 'snarkjs';
import { buildPoseidon } from 'circomlib';

export interface NoteData {
  nullifier: string;
  secret: string;
  amount: string;
  depositIndex: number;
}

export interface MerkleProof {
  root: string;
  pathElements: string[];
  pathIndices: number[];
}

export class ZKProofGenerator {
  private poseidon: any;
  private wasmPath: string;
  private zkeyPath: string;

  constructor() {
    this.wasmPath = '/withdraw.wasm';
    this.zkeyPath = '/withdraw.zkey';
  }

  async initialize() {
    this.poseidon = await buildPoseidon();
  }

  // Generate random note data
  generateNote(): NoteData {
    const nullifier = this.randomFieldElement();
    const secret = this.randomFieldElement();
    
    return {
      nullifier: nullifier.toString(),
      secret: secret.toString(),
      amount: '100000000', // 0.1 SOL in lamports
      depositIndex: -1, // Will be set after deposit
    };
  }

  // Compute commitment from note data
  computeCommitment(note: NoteData): string {
    const commitment = this.poseidon([
      BigInt(note.nullifier),
      BigInt(note.secret)
    ]);
    return commitment.toString();
  }

  // Compute nullifier hash
  computeNullifierHash(nullifier: string): string {
    const nullifierHash = this.poseidon([BigInt(nullifier)]);
    return nullifierHash.toString();
  }

  // Generate ZK proof for withdrawal
  async generateWithdrawalProof(
    note: NoteData,
    merkleProof: MerkleProof,
    recipient: string,
    relayer: string = '0',
    fee: number = 0
  ): Promise<{ proof: Uint8Array; publicSignals: string[] }> {
    const circuitInputs = {
      // Public inputs
      root: merkleProof.root,
      nullifierHash: this.computeNullifierHash(note.nullifier),
      recipient: this.addressToFieldElement(recipient),
      relayer: this.addressToFieldElement(relayer),
      fee: fee.toString(),

      // Private inputs
      nullifier: note.nullifier,
      secret: note.secret,
      pathElements: merkleProof.pathElements,
      pathIndices: merkleProof.pathIndices,
    };

    console.log('Generating ZK proof...');
    const startTime = Date.now();

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      circuitInputs,
      this.wasmPath,
      this.zkeyPath
    );

    const endTime = Date.now();
    console.log(`Proof generated in ${endTime - startTime}ms`);

    // Convert proof to bytes for Solana
    const proofBytes = this.serializeProof(proof);

    return { proof: proofBytes, publicSignals };
  }

  // Generate Merkle proof for commitment
  async generateMerkleProof(
    commitment: string,
    depositIndex: number,
    tornadoState: any
  ): Promise<MerkleProof> {
    // This would typically query the Solana program for tree state
    // For now, we'll implement a simplified version
    
    const pathElements: string[] = [];
    const pathIndices: number[] = [];
    
    let currentIndex = depositIndex;
    
    // Build path from leaf to root
    for (let level = 0; level < 20; level++) {
      const isRight = currentIndex % 2 === 1;
      const siblingIndex = isRight ? currentIndex - 1 : currentIndex + 1;
      
      // Get sibling from tornado state or use zero hash
      const sibling = this.getSiblingHash(tornadoState, level, siblingIndex);
      
      pathElements.push(sibling);
      pathIndices.push(isRight ? 1 : 0);
      
      currentIndex = Math.floor(currentIndex / 2);
    }

    // Compute root
    let currentHash = commitment;
    for (let i = 0; i < pathElements.length; i++) {
      const left = pathIndices[i] === 0 ? currentHash : pathElements[i];
      const right = pathIndices[i] === 0 ? pathElements[i] : currentHash;
      currentHash = this.poseidon([BigInt(left), BigInt(right)]).toString();
    }

    return {
      root: currentHash,
      pathElements,
      pathIndices,
    };
  }

  // Helper functions
  private randomFieldElement(): bigint {
    // Generate random 31-byte value (to fit in BN254 field)
    const bytes = new Uint8Array(31);
    crypto.getRandomValues(bytes);
    return BigInt('0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(''));
  }

  private addressToFieldElement(address: string): string {
    // Convert Solana address to field element
    // This is a simplified conversion - in production, ensure proper field arithmetic
    const bytes = new PublicKey(address).toBytes();
    bytes[31] &= 0x1f; // Ensure < field modulus
    return BigInt('0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')).toString();
  }

  private serializeProof(proof: any): Uint8Array {
    // Convert snarkjs proof format to bytes for Solana
    // This is a simplified serialization - use proper encoding in production
    const proofBytes = new Uint8Array(256);
    // ... implement proper proof serialization
    return proofBytes;
  }

  private getSiblingHash(tornadoState: any, level: number, siblingIndex: number): string {
    // Get sibling hash from tornado state or return zero hash
    // This would query the actual Merkle tree state
    return '0'; // Placeholder
  }
}
```

### Step 4: Web Worker for Proof Generation (Day 3)

**Create workers/zkWorker.ts**:
```typescript
import { ZKProofGenerator, NoteData, MerkleProof } from '../utils/zkProof';

// Web worker for ZK proof generation to avoid blocking UI
let zkGenerator: ZKProofGenerator;

self.onmessage = async function(e) {
  const { type, data } = e.data;

  try {
    switch (type) {
      case 'INITIALIZE':
        zkGenerator = new ZKProofGenerator();
        await zkGenerator.initialize();
        self.postMessage({ type: 'INITIALIZED' });
        break;

      case 'GENERATE_PROOF':
        const { note, merkleProof, recipient, relayer, fee } = data;
        
        self.postMessage({ 
          type: 'PROOF_PROGRESS', 
          progress: 0,
          message: 'Starting proof generation...' 
        });

        const result = await zkGenerator.generateWithdrawalProof(
          note,
          merkleProof,
          recipient,
          relayer,
          fee
        );

        self.postMessage({
          type: 'PROOF_GENERATED',
          proof: result.proof,
          publicSignals: result.publicSignals
        });
        break;

      case 'COMPUTE_COMMITMENT':
        const commitment = zkGenerator.computeCommitment(data.note);
        self.postMessage({
          type: 'COMMITMENT_COMPUTED',
          commitment
        });
        break;

      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      error: error.message
    });
  }
};
```

### Step 5: React Components (Day 4-5)

**Create components/DepositForm.tsx**:
```tsx
import React, { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useConnection } from '@solana/wallet-adapter-react';
import { TornadoProgram } from '../utils/solana';
import { ZKProofGenerator, NoteData } from '../utils/zkProof';

export const DepositForm: React.FC = () => {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [isDepositing, setIsDepositing] = useState(false);
  const [noteString, setNoteString] = useState<string>('');
  const [txHash, setTxHash] = useState<string>('');

  const handleDeposit = async () => {
    if (!wallet.connected) {
      alert('Please connect your wallet');
      return;
    }

    setIsDepositing(true);
    try {
      // Generate note data
      const zkGenerator = new ZKProofGenerator();
      await zkGenerator.initialize();
      
      const note = zkGenerator.generateNote();
      const commitment = zkGenerator.computeCommitment(note);
      
      // Convert commitment to bytes
      const commitmentBytes = new Uint8Array(32);
      const commitmentBigInt = BigInt(commitment);
      for (let i = 0; i < 32; i++) {
        commitmentBytes[31 - i] = Number((commitmentBigInt >> BigInt(i * 8)) & 0xffn);
      }

      // Submit deposit transaction
      const program = new TornadoProgram(connection, wallet);
      const tx = await program.deposit(commitmentBytes);
      
      // Get deposit index from transaction logs
      const depositIndex = await getDepositIndexFromTx(connection, tx);
      note.depositIndex = depositIndex;

      // Generate note string
      const noteData = btoa(JSON.stringify(note));
      
      setNoteString(noteData);
      setTxHash(tx);
      
    } catch (error) {
      console.error('Deposit failed:', error);
      alert('Deposit failed: ' + error.message);
    } finally {
      setIsDepositing(false);
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h2 className="text-lg font-medium text-gray-900 mb-4">
        Deposit SOL
      </h2>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Amount
          </label>
          <div className="mt-1">
            <input
              type="text"
              value="0.1 SOL"
              disabled
              className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md bg-gray-50"
            />
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Fixed deposit amount for privacy
          </p>
        </div>

        <button
          onClick={handleDeposit}
          disabled={isDepositing || !wallet.connected}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          {isDepositing ? 'Depositing...' : 'Deposit 0.1 SOL'}
        </button>

        {noteString && (
          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
            <h3 className="text-sm font-medium text-yellow-800 mb-2">
              ⚠️ Save Your Note String
            </h3>
            <p className="text-sm text-yellow-700 mb-3">
              This is your ONLY way to withdraw your funds. Save it securely!
            </p>
            <textarea
              value={noteString}
              readOnly
              rows={4}
              className="w-full text-xs font-mono bg-white border border-yellow-300 rounded p-2"
            />
            <button
              onClick={() => navigator.clipboard.writeText(noteString)}
              className="mt-2 text-sm text-yellow-800 hover:text-yellow-900"
            >
              📋 Copy to Clipboard
            </button>
          </div>
        )}

        {txHash && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm text-green-700">
              ✅ Deposit successful! 
              <a 
                href={`https://explorer.solana.com/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-1 text-green-800 hover:text-green-900 underline"
              >
                View transaction
              </a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

async function getDepositIndexFromTx(connection: Connection, txHash: string): Promise<number> {
  // Parse transaction logs to extract deposit index
  // This would parse the DepositEvent from program logs
  return 0; // Placeholder
}
```

**Create components/WithdrawForm.tsx**:
```tsx
import React, { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { TornadoProgram } from '../utils/solana';
import { NoteData } from '../utils/zkProof';

export const WithdrawForm: React.FC = () => {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [noteString, setNoteString] = useState('');
  const [recipient, setRecipient] = useState('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [proofProgress, setProofProgress] = useState(0);
  const [proofMessage, setProofMessage] = useState('');
  const [txHash, setTxHash] = useState('');

  const handleWithdraw = async () => {
    if (!wallet.connected) {
      alert('Please connect your wallet');
      return;
    }

    if (!noteString || !recipient) {
      alert('Please provide note string and recipient address');
      return;
    }

    setIsWithdrawing(true);
    setProofProgress(0);

    try {
      // Parse note string
      const note: NoteData = JSON.parse(atob(noteString));
      
      // Validate recipient address
      const recipientPubkey = new PublicKey(recipient);

      // Get current tornado state for Merkle proof
      const program = new TornadoProgram(connection, wallet);
      const tornadoState = await program.getTornadoState();

      // Generate proof using web worker
      const worker = new Worker('/zkWorker.js');
      
      worker.postMessage({ type: 'INITIALIZE' });
      
      worker.onmessage = async (e) => {
        const { type, data } = e.data;
        
        switch (type) {
          case 'INITIALIZED':
            // Generate Merkle proof
            setProofMessage('Generating Merkle proof...');
            setProofProgress(20);
            
            // This would generate the actual Merkle proof
            const merkleProof = {
              root: '0', // Placeholder
              pathElements: new Array(20).fill('0'),
              pathIndices: new Array(20).fill(0)
            };
            
            // Start proof generation
            worker.postMessage({
              type: 'GENERATE_PROOF',
              data: {
                note,
                merkleProof,
                recipient,
                relayer: '0',
                fee: 0
              }
            });
            break;

          case 'PROOF_PROGRESS':
            setProofProgress(data.progress);
            setProofMessage(data.message);
            break;

          case 'PROOF_GENERATED':
            setProofMessage('Submitting withdrawal...');
            setProofProgress(90);
            
            // Submit withdrawal transaction
            const tx = await program.withdraw(
              data.proof,
              new Uint8Array(32), // root
              new Uint8Array(32), // nullifier hash
              recipientPubkey,
              PublicKey.default, // no relayer
              0 // no fee
            );
            
            setTxHash(tx);
            setProofProgress(100);
            setProofMessage('Withdrawal successful!');
            worker.terminate();
            break;

          case 'ERROR':
            throw new Error(data.error);
        }
      };

    } catch (error) {
      console.error('Withdrawal failed:', error);
      alert('Withdrawal failed: ' + error.message);
    } finally {
      setIsWithdrawing(false);
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h2 className="text-lg font-medium text-gray-900 mb-4">
        Withdraw SOL
      </h2>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Note String
          </label>
          <div className="mt-1">
            <textarea
              value={noteString}
              onChange={(e) => setNoteString(e.target.value)}
              rows={4}
              placeholder="Paste your note string here..."
              className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md font-mono text-xs"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Recipient Address
          </label>
          <div className="mt-1">
            <input
              type="text"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="Solana wallet address..."
              className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md font-mono"
            />
          </div>
        </div>

        <button
          onClick={handleWithdraw}
          disabled={isWithdrawing || !wallet.connected || !noteString || !recipient}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          {isWithdrawing ? 'Generating Proof...' : 'Withdraw 0.1 SOL'}
        </button>

        {isWithdrawing && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-blue-800">
                {proofMessage}
              </span>
              <span className="text-sm text-blue-600">
                {proofProgress}%
              </span>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${proofProgress}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-blue-600">
              Proof generation may take 30-60 seconds...
            </p>
          </div>
        )}

        {txHash && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm text-green-700">
              ✅ Withdrawal successful! 
              <a 
                href={`https://explorer.solana.com/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-1 text-green-800 hover:text-green-900 underline"
              >
                View transaction
              </a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
```

### Step 6: Main Application (Day 5)

**Update App.tsx**:
```tsx
import React from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';
import { DepositForm } from './components/DepositForm';
import { WithdrawForm } from './components/WithdrawForm';

// Import wallet adapter CSS
import '@solana/wallet-adapter-react-ui/styles.css';
import './App.css';

function App() {
  const network = WalletAdapterNetwork.Devnet;
  const endpoint = clusterApiUrl(network);
  
  const wallets = [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
  ];

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <div className="min-h-screen bg-gray-50">
            <nav className="bg-white shadow">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16">
                  <div className="flex items-center">
                    <h1 className="text-xl font-semibold text-gray-900">
                      🌪️ Tornado Cash on Solana
                    </h1>
                  </div>
                  <div className="flex items-center">
                    <WalletMultiButton />
                  </div>
                </div>
              </div>
            </nav>

            <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
              <div className="px-4 py-6 sm:px-0">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <DepositForm />
                  <WithdrawForm />
                </div>
                
                <div className="mt-8 bg-white shadow rounded-lg p-6">
                  <h2 className="text-lg font-medium text-gray-900 mb-4">
                    How It Works
                  </h2>
                  <div className="space-y-4 text-sm text-gray-600">
                    <div className="flex items-start">
                      <span className="flex-shrink-0 w-6 h-6 bg-indigo-100 text-indigo-800 rounded-full flex items-center justify-center text-xs font-medium mr-3">
                        1
                      </span>
                      <p>
                        <strong>Deposit:</strong> Send 0.1 SOL to the mixer and receive a secret note string. 
                        Your deposit is added to the anonymity pool.
                      </p>
                    </div>
                    <div className="flex items-start">
                      <span className="flex-shrink-0 w-6 h-6 bg-indigo-100 text-indigo-800 rounded-full flex items-center justify-center text-xs font-medium mr-3">
                        2
                      </span>
                      <p>
                        <strong>Wait:</strong> For maximum privacy, wait for other users to deposit. 
                        The larger the anonymity set, the stronger your privacy.
                      </p>
                    </div>
                    <div className="flex items-start">
                      <span className="flex-shrink-0 w-6 h-6 bg-indigo-100 text-indigo-800 rounded-full flex items-center justify-center text-xs font-medium mr-3">
                        3
                      </span>
                      <p>
                        <strong>Withdraw:</strong> Use your note string to generate a zero-knowledge proof 
                        and withdraw to any address. No one can link your deposit to your withdrawal.
                      </p>
                    </div>
                  </div>
                  
                  <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                    <h3 className="text-sm font-medium text-yellow-800 mb-2">
                      ⚠️ Security Notice
                    </h3>
                    <ul className="text-sm text-yellow-700 space-y-1">
                      <li>• Never share your note string with anyone</li>
                      <li>• Use a VPN for additional privacy</li>
                      <li>• Wait for multiple deposits before withdrawing</li>
                      <li>• This is experimental software - use at your own risk</li>
                    </ul>
                  </div>
                </div>
              </div>
            </main>
          </div>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export default App;
```

## Integration Points

### With Solana Program
- **Program ID**: Use deployed program address
- **Account Structure**: Match program's account layouts exactly
- **Instruction Format**: Ensure data serialization matches program expectations

### With Circuits Team
- **WASM Files**: Use compiled circuit WASM for proof generation
- **Proving Key**: Use proving key from trusted setup ceremony
- **Parameter Matching**: Ensure Poseidon parameters match circuit

### With Ceremony Team
- **Key Files**: Integrate proving key and verifying key from ceremony
- **Key Validation**: Verify keys work correctly with circuits
- **Performance Testing**: Ensure acceptable proving times in browser

## Performance Optimization

**Proof Generation**:
- Use Web Workers to avoid blocking UI
- Implement progress indicators for user feedback
- Consider proof caching for repeated operations

**Bundle Size**:
- Lazy load ZK proving components
- Use dynamic imports for large dependencies
- Optimize WASM file sizes

**User Experience**:
- Clear error messages and validation
- Responsive design for mobile users
- Offline capability for note generation

## Security Considerations

**Client-Side Security**:
- Never send private keys or secrets to server
- Use secure random number generation
- Validate all user inputs

**Privacy Protection**:
- No analytics or tracking
- Use HTTPS for all connections
- Consider Tor browser compatibility

**Error Handling**:
- Don't leak sensitive information in errors
- Graceful degradation for unsupported browsers
- Clear recovery instructions for failed operations

## Success Criteria

- [ ] Wallet connection works correctly
- [ ] Deposit flow generates valid note strings
- [ ] ZK proof generation works in browser
- [ ] Withdrawal flow completes successfully
- [ ] UI is responsive and user-friendly
- [ ] Error handling provides clear feedback
- [ ] Performance is acceptable (30-60s proof generation)

The frontend is the user's gateway to privacy - make it intuitive and secure! 🎨
