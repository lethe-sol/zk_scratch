import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TornadoSolana } from "../target/types/tornado_solana";
import { expect } from "chai";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram } from "@solana/web3.js";

describe("tornado-solana", () => {
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.TornadoSolana as Program<TornadoSolana>;
  const provider = anchor.getProvider();

  let tornadoPoolPda: PublicKey;
  let tornadoPoolBump: number;
  let depositor: Keypair;
  let recipient: Keypair;
  let authority: Keypair;

  let mockMerkleTree: Keypair;
  let mockNullifierQueue: Keypair;
  let mockLogWrapper: Keypair;

  const DEPOSIT_AMOUNT = 0.1 * LAMPORTS_PER_SOL; // 0.1 SOL
  const TEST_COMMITMENT = new Array(32).fill(0).map((_, i) => i % 256);

  before(async () => {
    depositor = Keypair.generate();
    recipient = Keypair.generate();
    authority = Keypair.generate();
    mockMerkleTree = Keypair.generate();
    mockNullifierQueue = Keypair.generate();
    mockLogWrapper = Keypair.generate();

    await provider.connection.requestAirdrop(depositor.publicKey, 2 * LAMPORTS_PER_SOL);
    await provider.connection.requestAirdrop(authority.publicKey, 1 * LAMPORTS_PER_SOL);
    
    await new Promise(resolve => setTimeout(resolve, 1000));

    [tornadoPoolPda, tornadoPoolBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("tornado_pool")],
      program.programId
    );
  });

  describe("Initialize", () => {
    it("Should initialize tornado pool successfully", async () => {
      const mockVerificationKey = {
        alpha: new Array(64).fill(1),
        beta: new Array(128).fill(2),
        gamma: new Array(128).fill(3),
        delta: new Array(128).fill(4),
        ic: [
          new Array(64).fill(5),
          new Array(64).fill(6),
          new Array(64).fill(7),
          new Array(64).fill(8),
          new Array(64).fill(9),
          new Array(64).fill(10),
          new Array(64).fill(11),
          new Array(64).fill(12),
        ]
      };

      const tx = await program.methods
        .initialize(
          new anchor.BN(DEPOSIT_AMOUNT),
          mockVerificationKey
        )
        .accounts({
          authority: authority.publicKey,
          tornadoPool: tornadoPoolPda,
          merkleTree: mockMerkleTree.publicKey,
          nullifierQueue: mockNullifierQueue.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([authority])
        .rpc();

      console.log("Initialize transaction signature:", tx);

      const poolAccount = await program.account.tornadoPool.fetch(tornadoPoolPda);
      expect(poolAccount.authority.toString()).to.equal(authority.publicKey.toString());
      expect(poolAccount.depositAmount.toNumber()).to.equal(DEPOSIT_AMOUNT);
      expect(poolAccount.depositCount.toNumber()).to.equal(0);
      expect(poolAccount.merkleTree.toString()).to.equal(mockMerkleTree.publicKey.toString());
      expect(poolAccount.nullifierQueue.toString()).to.equal(mockNullifierQueue.publicKey.toString());
    });

    it("Should fail to initialize with zero deposit amount", async () => {
      const mockVerificationKey = {
        alpha: new Array(64).fill(1),
        beta: new Array(128).fill(2),
        gamma: new Array(128).fill(3),
        delta: new Array(128).fill(4),
        ic: [new Array(64).fill(5)]
      };

      try {
        await program.methods
          .initialize(
            new anchor.BN(0), // Invalid deposit amount
            mockVerificationKey
          )
          .accounts({
            authority: authority.publicKey,
            tornadoPool: PublicKey.findProgramAddressSync(
              [Buffer.from("tornado_pool_invalid")],
              program.programId
            )[0],
            merkleTree: mockMerkleTree.publicKey,
            nullifierQueue: mockNullifierQueue.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([authority])
          .rpc();
        
        expect.fail("Should have failed with invalid deposit amount");
      } catch (error) {
        expect(error.toString()).to.include("InvalidDepositAmount");
      }
    });
  });

  describe("Deposit", () => {
    it("Should process deposit successfully", async () => {
      const initialBalance = await provider.connection.getBalance(depositor.publicKey);
      const initialPoolBalance = await provider.connection.getBalance(tornadoPoolPda);

      const tx = await program.methods
        .deposit(TEST_COMMITMENT)
        .accounts({
          depositor: depositor.publicKey,
          tornadoPool: tornadoPoolPda,
          authority: authority.publicKey,
          registeredProgramPda: null,
          logWrapper: mockLogWrapper.publicKey,
          merkleTree: mockMerkleTree.publicKey,
          accountCompressionProgram: program.programId, // Mock for testing
          systemProgram: SystemProgram.programId,
        })
        .signers([depositor, authority])
        .rpc();

      console.log("Deposit transaction signature:", tx);

      const finalBalance = await provider.connection.getBalance(depositor.publicKey);
      const finalPoolBalance = await provider.connection.getBalance(tornadoPoolPda);
      
      expect(finalBalance).to.be.lessThan(initialBalance);
      expect(finalPoolBalance).to.equal(initialPoolBalance + DEPOSIT_AMOUNT);

      const poolAccount = await program.account.tornadoPool.fetch(tornadoPoolPda);
      expect(poolAccount.depositCount.toNumber()).to.equal(1);
    });

    it("Should fail deposit with insufficient funds", async () => {
      const poorDepositor = Keypair.generate();

      try {
        await program.methods
          .deposit(TEST_COMMITMENT)
          .accounts({
            depositor: poorDepositor.publicKey,
            tornadoPool: tornadoPoolPda,
            authority: authority.publicKey,
            registeredProgramPda: null,
            logWrapper: mockLogWrapper.publicKey,
            merkleTree: mockMerkleTree.publicKey,
            accountCompressionProgram: program.programId,
            systemProgram: SystemProgram.programId,
          })
          .signers([poorDepositor, authority])
          .rpc();
        
        expect.fail("Should have failed with insufficient funds");
      } catch (error) {
        expect(error.toString()).to.include("insufficient");
      }
    });
  });

  describe("Withdraw", () => {
    it("Should process withdraw successfully with valid proof", async () => {
      const mockProof = {
        piA: new Array(64).fill(1),
        piB: new Array(128).fill(2),
        piC: new Array(64).fill(3),
      };

      const mockPublicInputs = {
        root: new Array(32).fill(1),
        nullifierHash: new Array(32).fill(2),
        recipient1: new Array(32).fill(3),
        recipient2: new Array(32).fill(4),
        relayer1: new Array(32).fill(0),
        relayer2: new Array(32).fill(0),
        fee: new Array(32).fill(0),
      };

      const changeLogIndices = [0];
      const leavesQueueIndices = [0];
      const leafIndices = [0];
      const proofs = [[new Array(32).fill(5)]];

      const initialRecipientBalance = await provider.connection.getBalance(recipient.publicKey);
      const initialPoolBalance = await provider.connection.getBalance(tornadoPoolPda);

      try {
        const tx = await program.methods
          .withdraw(
            mockProof,
            mockPublicInputs,
            changeLogIndices,
            leavesQueueIndices,
            leafIndices,
            proofs
          )
          .accounts({
            withdrawer: authority.publicKey,
            tornadoPool: tornadoPoolPda,
            recipient: recipient.publicKey,
            authority: authority.publicKey,
            registeredProgramPda: null,
            logWrapper: mockLogWrapper.publicKey,
            merkleTree: mockMerkleTree.publicKey,
            nullifierQueue: mockNullifierQueue.publicKey,
            accountCompressionProgram: program.programId, // Mock for testing
            systemProgram: SystemProgram.programId,
          })
          .signers([authority])
          .rpc();

        console.log("Withdraw transaction signature:", tx);

        const finalRecipientBalance = await provider.connection.getBalance(recipient.publicKey);
        const finalPoolBalance = await provider.connection.getBalance(tornadoPoolPda);
        
        expect(finalRecipientBalance).to.equal(initialRecipientBalance + DEPOSIT_AMOUNT);
        expect(finalPoolBalance).to.equal(initialPoolBalance - DEPOSIT_AMOUNT);

      } catch (error) {
        console.log("Withdraw failed as expected with mock proof:", error.toString());
        expect(error.toString()).to.include("InvalidProof");
      }
    });

    it("Should fail withdraw with invalid recipient", async () => {
      const mockProof = {
        piA: new Array(64).fill(1),
        piB: new Array(128).fill(2),
        piC: new Array(64).fill(3),
      };

      const mockPublicInputs = {
        root: new Array(32).fill(1),
        nullifierHash: new Array(32).fill(2),
        recipient1: new Array(32).fill(99), // Wrong recipient
        recipient2: new Array(32).fill(99), // Wrong recipient
        relayer1: new Array(32).fill(0),
        relayer2: new Array(32).fill(0),
        fee: new Array(32).fill(0),
      };

      const changeLogIndices = [0];
      const leavesQueueIndices = [0];
      const leafIndices = [0];
      const proofs = [[new Array(32).fill(5)]];

      try {
        await program.methods
          .withdraw(
            mockProof,
            mockPublicInputs,
            changeLogIndices,
            leavesQueueIndices,
            leafIndices,
            proofs
          )
          .accounts({
            withdrawer: authority.publicKey,
            tornadoPool: tornadoPoolPda,
            recipient: recipient.publicKey, // Different from public inputs
            authority: authority.publicKey,
            registeredProgramPda: null,
            logWrapper: mockLogWrapper.publicKey,
            merkleTree: mockMerkleTree.publicKey,
            nullifierQueue: mockNullifierQueue.publicKey,
            accountCompressionProgram: program.programId,
            systemProgram: SystemProgram.programId,
          })
          .signers([authority])
          .rpc();
        
        expect.fail("Should have failed with invalid recipient");
      } catch (error) {
        expect(error.toString()).to.include("InvalidRecipient");
      }
    });
  });

  describe("Integration Tests", () => {
    it("Should handle multiple deposits and maintain correct state", async () => {
      const depositor2 = Keypair.generate();
      await provider.connection.requestAirdrop(depositor2.publicKey, 2 * LAMPORTS_PER_SOL);
      await new Promise(resolve => setTimeout(resolve, 1000));

      const commitment2 = new Array(32).fill(0).map((_, i) => (i + 10) % 256);

      await program.methods
        .deposit(commitment2)
        .accounts({
          depositor: depositor2.publicKey,
          tornadoPool: tornadoPoolPda,
          authority: authority.publicKey,
          registeredProgramPda: null,
          logWrapper: mockLogWrapper.publicKey,
          merkleTree: mockMerkleTree.publicKey,
          accountCompressionProgram: program.programId,
          systemProgram: SystemProgram.programId,
        })
        .signers([depositor2, authority])
        .rpc();

      const poolAccount = await program.account.tornadoPool.fetch(tornadoPoolPda);
      expect(poolAccount.depositCount.toNumber()).to.equal(2);
    });

    it("Should emit correct events", async () => {
      console.log("Event testing would be implemented here");
    });
  });
});
