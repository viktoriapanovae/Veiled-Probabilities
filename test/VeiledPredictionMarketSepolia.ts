import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm, deployments } from "hardhat";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { VeiledPredictionMarket } from "../types";

type Signers = {
  alice: HardhatEthersSigner;
};

describe("VeiledPredictionMarketSepolia", function () {
  let signers: Signers;
  let market: VeiledPredictionMarket;
  let marketAddress: string;
  let step: number;
  let steps: number;

  function progress(message: string) {
    console.log(`${++step}/${steps} ${message}`);
  }

  before(async function () {
    if (fhevm.isMock) {
      console.warn(`This hardhat test suite can only run on Sepolia Testnet`);
      this.skip();
    }

    try {
      const deployment = await deployments.get("VeiledPredictionMarket");
      marketAddress = deployment.address;
      market = await ethers.getContractAt("VeiledPredictionMarket", deployment.address);
    } catch (e) {
      (e as Error).message += ". Call 'npx hardhat deploy --network sepolia'";
      throw e;
    }

    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { alice: ethSigners[0] };
  });

  beforeEach(async () => {
    step = 0;
    steps = 0;
  });

  it("places an encrypted bet and decrypts totals", async function () {
    steps = 10;
    this.timeout(4 * 40000);

    progress("Checking prediction count...");
    let predictionCount = await market.getPredictionCount();

    if (predictionCount === 0n) {
      progress("Creating prediction...");
      const txCreate = await market
        .connect(signers.alice)
        .createPrediction("Sepolia demo", ["Option A", "Option B"]);
      await txCreate.wait();
      predictionCount = await market.getPredictionCount();
    }

    progress("Encrypting choice...");
    const encryptedChoice = await fhevm
      .createEncryptedInput(marketAddress, signers.alice.address)
      .add8(0)
      .encrypt();

    progress("Placing bet...");
    const txBet = await market
      .connect(signers.alice)
      .placeBet(0, encryptedChoice.handles[0], encryptedChoice.inputProof, { value: 1n });
    await txBet.wait();

    progress("Granting access...");
    const txGrant = await market.connect(signers.alice).grantAccess(0);
    await txGrant.wait();

    progress("Reading encrypted totals...");
    const [totalStaked, totalBets] = await market.getPredictionTotals(0);

    progress("Decrypting totals...");
    const clearTotalStaked = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      totalStaked,
      marketAddress,
      signers.alice,
    );
    const clearTotalBets = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      totalBets,
      marketAddress,
      signers.alice,
    );

    expect(BigInt(clearTotalStaked.toString())).to.be.greaterThan(0n);
    expect(parseInt(clearTotalBets.toString(), 10)).to.be.greaterThan(0);
  });
});
