import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TornadoSolana } from "../target/types/tornado_solana";
import { expect } from "chai";

describe("tornado-solana", () => {
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.TornadoSolana as Program<TornadoSolana>;

  it("Initializes the merkle tree", async () => {
    console.log("Initialize tree test - to be implemented");
  });

  it("Processes a deposit", async () => {
    console.log("Deposit test - to be implemented");
  });

  it("Processes a withdrawal", async () => {
    console.log("Withdraw test - to be implemented");
  });
});
