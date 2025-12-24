import { FhevmType } from "@fhevm/hardhat-plugin";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

/**
 * Example:
 *   - npx hardhat --network sepolia prediction:address
 */
task("prediction:address", "Prints the VeiledPredictionMarket address").setAction(async function (
  _taskArguments: TaskArguments,
  hre,
) {
  const { deployments } = hre;
  const deployment = await deployments.get("VeiledPredictionMarket");
  console.log(`VeiledPredictionMarket address is ${deployment.address}`);
});

/**
 * Example:
 *   - npx hardhat --network sepolia prediction:create --title "ETH ETF" --options "Approve,Reject"
 */
task("prediction:create", "Creates a new prediction")
  .addParam("title", "Prediction title")
  .addParam("options", "Comma-separated list of options (2-4)")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;
    const deployment = await deployments.get("VeiledPredictionMarket");
    const options = taskArguments.options
      .split(",")
      .map((option: string) => option.trim())
      .filter((option: string) => option.length > 0);

    if (options.length < 2 || options.length > 4) {
      throw new Error("Options must contain between 2 and 4 entries.");
    }

    const signers = await ethers.getSigners();
    const contract = await ethers.getContractAt("VeiledPredictionMarket", deployment.address);
    const tx = await contract.connect(signers[0]).createPrediction(taskArguments.title, options);
    console.log(`Wait for tx:${tx.hash}...`);
    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);
  });

/**
 * Example:
 *   - npx hardhat --network sepolia prediction:bet --prediction 0 --option 1 --amount 0.01
 */
task("prediction:bet", "Places an encrypted bet on a prediction")
  .addParam("prediction", "Prediction id")
  .addParam("option", "Option index")
  .addParam("amount", "ETH amount")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    const predictionId = parseInt(taskArguments.prediction);
    const optionIndex = parseInt(taskArguments.option);
    if (!Number.isInteger(predictionId) || !Number.isInteger(optionIndex)) {
      throw new Error("Prediction id and option index must be integers.");
    }

    await fhevm.initializeCLIApi();

    const deployment = await deployments.get("VeiledPredictionMarket");
    const signers = await ethers.getSigners();
    const contract = await ethers.getContractAt("VeiledPredictionMarket", deployment.address);

    const encryptedChoice = await fhevm
      .createEncryptedInput(deployment.address, signers[0].address)
      .add8(optionIndex)
      .encrypt();

    const tx = await contract
      .connect(signers[0])
      .placeBet(predictionId, encryptedChoice.handles[0], encryptedChoice.inputProof, {
        value: ethers.parseEther(taskArguments.amount),
      });
    console.log(`Wait for tx:${tx.hash}...`);
    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);
  });

/**
 * Example:
 *   - npx hardhat --network sepolia prediction:grant --prediction 0
 */
task("prediction:grant", "Grant decryption access to prediction totals and counts")
  .addParam("prediction", "Prediction id")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;
    const predictionId = parseInt(taskArguments.prediction);
    if (!Number.isInteger(predictionId)) {
      throw new Error("Prediction id must be an integer.");
    }

    const deployment = await deployments.get("VeiledPredictionMarket");
    const signers = await ethers.getSigners();
    const contract = await ethers.getContractAt("VeiledPredictionMarket", deployment.address);
    const tx = await contract.connect(signers[0]).grantAccess(predictionId);
    console.log(`Wait for tx:${tx.hash}...`);
    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);
  });

/**
 * Example:
 *   - npx hardhat --network sepolia prediction:decrypt --prediction 0
 */
task("prediction:decrypt", "Decrypts prediction totals and option counts")
  .addParam("prediction", "Prediction id")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;
    const predictionId = parseInt(taskArguments.prediction);
    if (!Number.isInteger(predictionId)) {
      throw new Error("Prediction id must be an integer.");
    }

    await fhevm.initializeCLIApi();

    const deployment = await deployments.get("VeiledPredictionMarket");
    const signers = await ethers.getSigners();
    const contract = await ethers.getContractAt("VeiledPredictionMarket", deployment.address);

    const [totalStaked, totalBets] = await contract.getPredictionTotals(predictionId);
    const optionCounts = await contract.getOptionCounts(predictionId);

    const clearTotalStaked = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      totalStaked,
      deployment.address,
      signers[0],
    );
    const clearTotalBets = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      totalBets,
      deployment.address,
      signers[0],
    );

    console.log(`Total staked: ${clearTotalStaked}`);
    console.log(`Total bets  : ${clearTotalBets}`);

    for (let i = 0; i < optionCounts.length; i++) {
      const clearCount = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        optionCounts[i],
        deployment.address,
        signers[0],
      );
      console.log(`Option ${i} count: ${clearCount}`);
    }
  });
