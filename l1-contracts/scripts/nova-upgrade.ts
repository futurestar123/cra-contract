// hardhat import should be the first import in the file
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Command } from "commander";
import { Wallet, ethers } from "ethers";
import { Deployer } from "../src.ts/deploy";
import { formatUnits, parseUnits } from "ethers/lib/utils";
import { web3Provider, GAS_MULTIPLIER } from "./utils";
import { deployedAddressesFromEnv } from "../src.ts/deploy-utils";
import {
  novaUpgradeDeployment,
  novaUpgradeInitStage1,
  novaUpgradeInitStage2,
  upgradeL1ERC20Bridge,
} from "../src.ts/deploy-process";
import { ethTestConfig, getAddressFromEnv } from "../src.ts/utils";

const provider = web3Provider();

async function main() {
  const program = new Command();

  program.version("0.1.0").name("nova upgrade").description("deploy L1 contracts for nova upgrade");

  program
    .command("deploy")
    .option("--private-key <private-key>")
    .option("--gas-price <gas-price>")
    .option("--create2-salt <create2-salt>")
    .action(async (cmd) => {
      const deployWallet = cmd.privateKey
        ? new Wallet(cmd.privateKey, provider)
        : Wallet.fromMnemonic(
            process.env.MNEMONIC ? process.env.MNEMONIC : ethTestConfig.mnemonic,
            "m/44'/60'/0'/0/1"
          ).connect(provider);
      console.log(`Using deployer wallet: ${deployWallet.address}`);

      const ownerAddress = getAddressFromEnv("CONTRACTS_GOVERNANCE_ADDR");
      console.log(`Using owner address: ${ownerAddress}`);

      const gasPrice = cmd.gasPrice
        ? parseUnits(cmd.gasPrice, "gwei")
        : (await provider.getGasPrice()).mul(GAS_MULTIPLIER);
      console.log(`Using gas price: ${formatUnits(gasPrice, "gwei")} gwei`);

      const create2Salt = cmd.create2Salt ? cmd.create2Salt : ethers.utils.hexlify(ethers.utils.randomBytes(32));

      const deployer = new Deployer({
        deployWallet,
        addresses: deployedAddressesFromEnv(),
        ownerAddress,
        verbose: true,
      });

      await novaUpgradeDeployment(deployer, gasPrice, create2Salt);
    });

  program
    .command("init-stage-1")
    .option("--private-key <private-key>")
    .option("--gas-price <gas-price>")
    .option("--print-operation <print-operation>")
    .action(async (cmd) => {
      const deployWallet = cmd.privateKey
        ? new Wallet(cmd.privateKey, provider)
        : Wallet.fromMnemonic(
            process.env.MNEMONIC ? process.env.MNEMONIC : ethTestConfig.mnemonic,
            "m/44'/60'/0'/0/1"
          ).connect(provider);
      console.log(`Using deployer wallet: ${deployWallet.address}`);

      const gasPrice = cmd.gasPrice
        ? parseUnits(cmd.gasPrice, "gwei")
        : (await provider.getGasPrice()).mul(GAS_MULTIPLIER);
      console.log(`Using gas price: ${formatUnits(gasPrice, "gwei")} gwei`);

      const printOperation = !!cmd.printOperation && cmd.printOperation === "true";

      const deployer = new Deployer({
        deployWallet,
        verbose: true,
      });

      await novaUpgradeInitStage1(deployer, gasPrice, printOperation);
    });

  program
    .command("init-stage-2")
    .option("--private-key <private-key>")
    .option("--gas-price <gas-price>")
    .option("--print-operation <print-operation>")
    .action(async (cmd) => {
      const deployWallet = cmd.privateKey
        ? new Wallet(cmd.privateKey, provider)
        : Wallet.fromMnemonic(
            process.env.MNEMONIC ? process.env.MNEMONIC : ethTestConfig.mnemonic,
            "m/44'/60'/0'/0/1"
          ).connect(provider);
      console.log(`Using deployer wallet: ${deployWallet.address}`);

      const gasPrice = cmd.gasPrice
        ? parseUnits(cmd.gasPrice, "gwei")
        : (await provider.getGasPrice()).mul(GAS_MULTIPLIER);
      console.log(`Using gas price: ${formatUnits(gasPrice, "gwei")} gwei`);

      const printOperation = !!cmd.printOperation && cmd.printOperation === "true";

      const deployer = new Deployer({
        deployWallet,
        verbose: true,
      });

      await novaUpgradeInitStage2(deployer, gasPrice, printOperation);
    });

  program
    .command("upgrade-l1-erc20-bridge")
    .option("--private-key <private-key>")
    .option("--gas-price <gas-price>")
    .option("--print-operation <print-operation>")
    .action(async (cmd) => {
      const deployWallet = cmd.privateKey
        ? new Wallet(cmd.privateKey, provider)
        : Wallet.fromMnemonic(
            process.env.MNEMONIC ? process.env.MNEMONIC : ethTestConfig.mnemonic,
            "m/44'/60'/0'/0/1"
          ).connect(provider);
      console.log(`Using deployer wallet: ${deployWallet.address}`);

      const gasPrice = cmd.gasPrice
        ? parseUnits(cmd.gasPrice, "gwei")
        : (await provider.getGasPrice()).mul(GAS_MULTIPLIER);
      console.log(`Using gas price: ${formatUnits(gasPrice, "gwei")} gwei`);

      const printOperation = !!cmd.printOperation && cmd.printOperation === "true";

      const deployer = new Deployer({
        deployWallet,
        verbose: true,
      });

      await upgradeL1ERC20Bridge(deployer, gasPrice, printOperation);
    });

  await program.parseAsync(process.argv);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
