// hardhat import should be the first import in the file
import { deployedAddressesFromEnv } from "../src.ts/deploy-utils";

import { Deployer } from "../src.ts/deploy";
import { Wallet } from "ethers";
import { web3Provider } from "./utils";
import { verifyBridgeHub, verifyL1SharedBridge, verifyPromise, verifyStm, verifyValidatorTimelock } from "./verify";
import { getAddressFromEnv, getNumberFromEnv } from "../src.ts/utils";

const provider = web3Provider();

// Note: running all verifications in parallel might be too much for etherscan, comment out some of them if needed
async function main() {
  if (process.env.CHAIN_ETH_NETWORK == "localhost") {
    console.log("Skip contract verification on localhost");
    return;
  }
  if (!process.env.MISC_ETHERSCAN_API_KEY) {
    console.log("Skip contract verification given etherscan api key is missing");
    return;
  }
  if (!process.env.DEPLOYER_PRIVATE_KEY) {
    console.log("Skip contract verification deployer private key is missing");
    return;
  }
  const addresses = deployedAddressesFromEnv();

  const deployWallet = new Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
  const ownerAddress = addresses.Governance;
  const deployer = new Deployer({
    deployWallet,
    addresses: deployedAddressesFromEnv(),
    ownerAddress: ownerAddress,
    verbose: true,
  });

  await verifyValidatorTimelock(addresses.ValidatorTimeLock, ownerAddress);

  await verifyPromise(addresses.ChainAdmin, [ownerAddress]);
  await verifyPromise(addresses.TransparentProxyAdmin);

  // bridgehub
  await verifyBridgeHub(addresses, ownerAddress);

  // Contracts without constructor parameters
  for (const address of [
    addresses.StateTransition.GettersFacet,
    addresses.StateTransition.DiamondInit,
    addresses.StateTransition.AdminFacet,
    addresses.StateTransition.ExecutorFacet,
    addresses.StateTransition.Verifier,
    addresses.StateTransition.GenesisUpgrade,
    addresses.StateTransition.DefaultUpgrade,
    getAddressFromEnv("CONTRACTS_HYPERCHAIN_UPGRADE_ADDR"),
  ]) {
    await verifyPromise(address);
  }
  await verifyPromise(addresses.StateTransition.MailboxFacet, [getNumberFromEnv("CONTRACTS_ERA_CHAIN_ID")]);

  // stm
  await verifyStm(addresses, deployer);

  // bridges
  await verifyL1SharedBridge(addresses, ownerAddress);

  await verifyPromise(addresses.Bridges.ERC20BridgeImplementation, [addresses.Bridges.SharedBridgeProxy]);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err.message || err);
    process.exit(1);
  });
