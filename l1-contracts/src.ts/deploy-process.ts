// hardhat import should be the first import in the file
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import "@nomiclabs/hardhat-ethers";

import type { BigNumberish } from "ethers";
import { ethers } from "ethers";

import type { FacetCut } from "./diamondCut";

import type { Deployer } from "./deploy";
import { getTokens } from "./deploy-token";

import { ADDRESS_ONE, DIAMOND_CUT_DATA_ABI_STRING, getAddressFromEnv } from "./utils";
import { ITransparentUpgradeableProxyFactory } from "../typechain/ITransparentUpgradeableProxyFactory";

export const L2_BOOTLOADER_BYTECODE_HASH = "0x1000100000000000000000000000000000000000000000000000000000000000";
export const L2_DEFAULT_ACCOUNT_BYTECODE_HASH = "0x1001000000000000000000000000000000000000000000000000000000000000";

export async function initialBridgehubDeployment(
  deployer: Deployer,
  extraFacets: FacetCut[],
  gasPrice: BigNumberish,
  onlyVerifier: boolean,
  create2Salt?: string,
  nonce?: number
) {
  nonce = nonce || (await deployer.deployWallet.getTransactionCount());
  create2Salt = create2Salt || ethers.utils.hexlify(ethers.utils.randomBytes(32));

  // Create2 factory already deployed on the public networks, only deploy it on local node
  if (process.env.CHAIN_ETH_NETWORK === "localhost" || process.env.CHAIN_ETH_NETWORK === "hardhat") {
    await deployer.deployCreate2Factory({ gasPrice, nonce });
    nonce++;

    await deployer.deployMulticall3(create2Salt, { gasPrice, nonce });
    nonce++;
  }

  if (onlyVerifier) {
    await deployer.deployVerifier(create2Salt, { gasPrice, nonce });
    return;
  }

  await deployer.deployDefaultUpgrade(create2Salt, {
    gasPrice,
    nonce,
  });
  nonce++;

  await deployer.deployGenesisUpgrade(create2Salt, {
    gasPrice,
    nonce,
  });
  nonce++;

  await deployer.deployValidatorTimelock(create2Salt, { gasPrice, nonce });
  nonce++;

  await deployer.deployGovernance(create2Salt, { gasPrice, nonce });
  nonce++;

  await deployer.deployChainAdmin(create2Salt, { gasPrice, nonce });
  await deployer.deployTransparentProxyAdmin(create2Salt, { gasPrice });
  await deployer.deployBridgehubContract(create2Salt, gasPrice);
  await deployer.deployBlobVersionedHashRetriever(create2Salt, { gasPrice });
  await deployer.deployStateTransitionManagerContract(create2Salt, extraFacets, gasPrice);
  await deployer.setStateTransitionManagerInValidatorTimelock({ gasPrice });

  await deployer.deploySharedBridgeContracts(create2Salt, gasPrice);
  await deployer.deployERC20BridgeImplementation(create2Salt, { gasPrice });
  await deployer.deployERC20BridgeProxy(create2Salt, { gasPrice });
  await deployer.setParametersSharedBridge(gasPrice);
}

export async function novaUpgradeDeployment(deployer: Deployer, gasPrice: BigNumberish, create2Salt?: string) {
  create2Salt = create2Salt || ethers.utils.hexlify(ethers.utils.randomBytes(32));

  await deployer.deployDefaultUpgrade(create2Salt, { gasPrice });

  await deployer.deployGenesisUpgrade(create2Salt, { gasPrice });

  await deployer.deployNovaUpgrade(create2Salt, { gasPrice });

  await deployer.deployValidatorTimelock(create2Salt, { gasPrice });

  await deployer.deployChainAdmin(create2Salt, { gasPrice });
  await deployer.deployTransparentProxyAdmin(create2Salt, { gasPrice });

  await deployer.deployBridgehubContract(create2Salt, gasPrice);

  await deployer.deployStateTransitionDiamondInit(create2Salt, { gasPrice });
  await deployer.deployStateTransitionManagerImplementation(create2Salt, { gasPrice });
  await deployer.deployStateTransitionManagerProxy(create2Salt, { gasPrice });

  await deployer.deploySharedBridgeImplementation(create2Salt, { gasPrice });
  await deployer.deploySharedBridgeProxy(create2Salt, { gasPrice });

  await deployer.deployERC20BridgeImplementation(create2Salt, { gasPrice });
}

export async function novaUpgradeInitStage1(deployer: Deployer, gasPrice?: BigNumberish, printOperation?: boolean) {
  // init ValidatorTimelock
  const validatoTimelock = deployer.validatorTimelock(deployer.deployWallet);
  console.log("ValidatorTimelock: setStateTransitionManager");
  let calldata = validatoTimelock.interface.encodeFunctionData("setStateTransitionManager", [
    deployer.addresses.StateTransition.StateTransitionProxy,
  ]);
  await deployer.executeUpgrade(deployer.addresses.ValidatorTimeLock, 0, calldata, gasPrice, printOperation);

  // init stm
  const stm = deployer.stateTransitionManagerContract(deployer.deployWallet);
  console.log("StateTransitionManager: registerAlreadyDeployedHyperchain");
  calldata = stm.interface.encodeFunctionData("registerAlreadyDeployedHyperchain", [
    deployer.chainId,
    deployer.addresses.StateTransition.DiamondProxy,
  ]);
  await deployer.executeUpgrade(
    deployer.addresses.StateTransition.StateTransitionProxy,
    0,
    calldata,
    gasPrice,
    printOperation
  );

  // init BridgeHub
  const bridgehub = deployer.bridgehubContract(deployer.deployWallet);
  console.log("Bridgehub: addStateTransitionManager");
  calldata = bridgehub.interface.encodeFunctionData("addStateTransitionManager", [
    deployer.addresses.StateTransition.StateTransitionProxy,
  ]);
  await deployer.executeUpgrade(deployer.addresses.Bridgehub.BridgehubProxy, 0, calldata, gasPrice, printOperation);

  console.log("Bridgehub: addToken");
  calldata = bridgehub.interface.encodeFunctionData("addToken", [ADDRESS_ONE]);
  await deployer.executeUpgrade(deployer.addresses.Bridgehub.BridgehubProxy, 0, calldata, gasPrice, printOperation);

  console.log("Bridgehub: setSharedBridge");
  calldata = bridgehub.interface.encodeFunctionData("setSharedBridge", [deployer.addresses.Bridges.SharedBridgeProxy]);
  await deployer.executeUpgrade(deployer.addresses.Bridgehub.BridgehubProxy, 0, calldata, gasPrice, printOperation);

  console.log("Bridgehub: createNewChain");
  const diamondCutData = await deployer.initialZkSyncHyperchainDiamondCut();
  const initialDiamondCut = new ethers.utils.AbiCoder().encode([DIAMOND_CUT_DATA_ABI_STRING], [diamondCutData]);
  calldata = bridgehub.interface.encodeFunctionData("createNewChain", [
    deployer.chainId,
    deployer.addresses.StateTransition.StateTransitionProxy,
    ADDRESS_ONE,
    0,
    deployer.addresses.ChainAdmin,
    initialDiamondCut,
  ]);
  await deployer.executeUpgrade(deployer.addresses.Bridgehub.BridgehubProxy, 0, calldata, gasPrice, printOperation);

  // init L1SharedBridge
  const l1SharedBridge = deployer.defaultSharedBridge(deployer.deployWallet);
  console.log("L1SharedBridge: setL1Erc20Bridge");
  calldata = l1SharedBridge.interface.encodeFunctionData("setL1Erc20Bridge", [
    deployer.addresses.Bridges.ERC20BridgeProxy,
  ]);
  await deployer.executeUpgrade(deployer.addresses.Bridges.SharedBridgeProxy, 0, calldata, gasPrice, printOperation);

  console.log("L1SharedBridge: initializeChainGovernance");
  calldata = l1SharedBridge.interface.encodeFunctionData("initializeChainGovernance", [
    deployer.chainId,
    deployer.addresses.Bridges.L2SharedBridgeProxy,
  ]);
  await deployer.executeUpgrade(deployer.addresses.Bridges.SharedBridgeProxy, 0, calldata, gasPrice, printOperation);
}

export async function novaUpgradeInitStage2(deployer: Deployer, gasPrice?: BigNumberish, printOperation?: boolean) {
  // init ValidatorTimelock
  const validatoTimelock = deployer.validatorTimelock(deployer.deployWallet);
  console.log("ValidatorTimelock: addValidator");
  const addValidatorCalldata = validatoTimelock.interface.encodeFunctionData("addValidator", [
    deployer.chainId,
    getAddressFromEnv("ETH_SENDER_SENDER_OPERATOR_COMMIT_ETH_ADDR"),
  ]);
  const chainAdmin = deployer.chainAdmin(deployer.deployWallet);
  const chainAdminCalls = [];
  chainAdminCalls.push({
    target: deployer.addresses.ValidatorTimeLock,
    value: 0,
    data: addValidatorCalldata,
  });
  let calldata = chainAdmin.interface.encodeFunctionData("multicall", [chainAdminCalls, true]);
  await deployer.executeUpgrade(deployer.addresses.ChainAdmin, 0, calldata, gasPrice, printOperation);

  // init L1SharedBridge
  const l1SharedBridge = deployer.defaultSharedBridge(deployer.deployWallet);
  console.log("L1SharedBridge: setEraPostDiamondUpgradeFirstBatch");
  calldata = l1SharedBridge.interface.encodeFunctionData("setEraPostDiamondUpgradeFirstBatch", [
    process.env.CONTRACTS_ERA_POST_DIAMOND_UPGRADE_FIRST_BATCH,
  ]);
  await deployer.executeUpgrade(deployer.addresses.Bridges.SharedBridgeProxy, 0, calldata, gasPrice, printOperation);

  console.log("L1SharedBridge: setEraPostLegacyBridgeUpgradeFirstBatch");
  calldata = l1SharedBridge.interface.encodeFunctionData("setEraPostLegacyBridgeUpgradeFirstBatch", [
    process.env.CONTRACTS_ERA_POST_LEGACY_BRIDGE_UPGRADE_FIRST_BATCH,
  ]);
  await deployer.executeUpgrade(deployer.addresses.Bridges.SharedBridgeProxy, 0, calldata, gasPrice, printOperation);

  console.log("L1SharedBridge: setEraLegacyBridgeLastDepositTime");
  calldata = l1SharedBridge.interface.encodeFunctionData("setEraLegacyBridgeLastDepositTime", [
    process.env.CONTRACTS_ERA_LEGACY_UPGRADE_LAST_DEPOSIT_BATCH,
    process.env.CONTRACTS_ERA_LEGACY_UPGRADE_LAST_DEPOSIT_TX_NUMBER,
  ]);
  await deployer.executeUpgrade(deployer.addresses.Bridges.SharedBridgeProxy, 0, calldata, gasPrice, printOperation);
}

export async function upgradeL1ERC20Bridge(deployer: Deployer, gasPrice?: BigNumberish, printOperation?: boolean) {
  const l1ERC20BridgeProxy = ITransparentUpgradeableProxyFactory.connect(
    deployer.addresses.Bridges.ERC20BridgeProxy,
    deployer.deployWallet
  );
  const calldata = l1ERC20BridgeProxy.interface.encodeFunctionData("upgradeTo", [
    deployer.addresses.Bridges.ERC20BridgeImplementation,
  ]);
  await deployer.executeUpgrade(deployer.addresses.Bridges.ERC20BridgeProxy, 0, calldata, gasPrice, printOperation);
}

export async function registerHyperchain(
  deployer: Deployer,
  validiumMode: boolean,
  extraFacets: FacetCut[],
  gasPrice: BigNumberish,
  baseTokenName?: string,
  chainId?: string,
  useGovernance: boolean = false
) {
  const testnetTokens = getTokens();

  const baseTokenAddress = baseTokenName
    ? testnetTokens.find((token: { symbol: string }) => token.symbol == baseTokenName).address
    : ADDRESS_ONE;

  if (!(await deployer.bridgehubContract(deployer.deployWallet).tokenIsRegistered(baseTokenAddress))) {
    await deployer.registerToken(baseTokenAddress, useGovernance);
  }
  await deployer.registerHyperchain(
    baseTokenAddress,
    validiumMode,
    extraFacets,
    gasPrice,
    null,
    chainId,
    useGovernance
  );
}
