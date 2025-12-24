import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { VeiledPredictionMarket, VeiledPredictionMarket__factory } from "../types";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory(
    "VeiledPredictionMarket",
  )) as VeiledPredictionMarket__factory;
  const market = (await factory.deploy()) as VeiledPredictionMarket;
  const marketAddress = await market.getAddress();

  return { market, marketAddress };
}

describe("VeiledPredictionMarket", function () {
  let signers: Signers;
  let market: VeiledPredictionMarket;
  let marketAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }

    ({ market, marketAddress } = await deployFixture());
  });

  it("creates a prediction and records encrypted bets", async function () {
    const txCreate = await market
      .connect(signers.alice)
      .createPrediction("ETH ETF approval", ["Approve", "Reject"]);
    await txCreate.wait();

    const predictionCount = await market.getPredictionCount();
    expect(predictionCount).to.eq(1);

    const encryptedChoiceAlice = await fhevm
      .createEncryptedInput(marketAddress, signers.alice.address)
      .add8(0)
      .encrypt();
    const betAmountAlice = 1n;

    const txBetAlice = await market
      .connect(signers.alice)
      .placeBet(0, encryptedChoiceAlice.handles[0], encryptedChoiceAlice.inputProof, { value: betAmountAlice });
    await txBetAlice.wait();

    const encryptedChoiceBob = await fhevm
      .createEncryptedInput(marketAddress, signers.bob.address)
      .add8(1)
      .encrypt();
    const betAmountBob = 2n;

    const txBetBob = await market
      .connect(signers.bob)
      .placeBet(0, encryptedChoiceBob.handles[0], encryptedChoiceBob.inputProof, { value: betAmountBob });
    await txBetBob.wait();

    const txGrant = await market.connect(signers.alice).grantAccess(0);
    await txGrant.wait();

    const [totalStaked, totalBets] = await market.getPredictionTotals(0);
    const optionCounts = await market.getOptionCounts(0);

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

    expect(BigInt(clearTotalStaked.toString())).to.eq(betAmountAlice + betAmountBob);
    expect(parseInt(clearTotalBets.toString(), 10)).to.eq(2);

    const clearCount0 = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      optionCounts[0],
      marketAddress,
      signers.alice,
    );
    const clearCount1 = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      optionCounts[1],
      marketAddress,
      signers.alice,
    );

    expect(parseInt(clearCount0.toString(), 10)).to.eq(1);
    expect(parseInt(clearCount1.toString(), 10)).to.eq(1);

    const [hasBet, encryptedChoice, encryptedAmount] = await market.getUserBet(0, signers.alice.address);
    expect(hasBet).to.eq(true);

    const clearChoice = await fhevm.userDecryptEuint(
      FhevmType.euint8,
      encryptedChoice,
      marketAddress,
      signers.alice,
    );
    const clearAmount = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      encryptedAmount,
      marketAddress,
      signers.alice,
    );

    expect(parseInt(clearChoice.toString(), 10)).to.eq(0);
    expect(BigInt(clearAmount.toString())).to.eq(betAmountAlice);
  });

  it("rejects invalid option lengths", async function () {
    await expect(market.createPrediction("Too short", ["OnlyOne"])).to.be.revertedWithCustomError(
      market,
      "InvalidOptions",
    );
    await expect(
      market.createPrediction("Too many", ["A", "B", "C", "D", "E"]),
    ).to.be.revertedWithCustomError(market, "InvalidOptions");
  });
});
