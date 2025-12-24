import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedMarket = await deploy("VeiledPredictionMarket", {
    from: deployer,
    log: true,
  });

  console.log(`VeiledPredictionMarket contract: `, deployedMarket.address);
};
export default func;
func.id = "deploy_veiledPredictionMarket"; // id required to prevent reexecution
func.tags = ["VeiledPredictionMarket"];
