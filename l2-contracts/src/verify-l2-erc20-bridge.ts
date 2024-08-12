import { Command } from "commander";
import { verifyPromise } from "./verify";

async function main() {
  const program = new Command();

  program.version("0.1.0").name("verify").description("verify L2 contracts");

  program.action(async () => {
    // Contracts without constructor parameters
    const chainId = process.env.CONTRACTS_ERA_CHAIN_ID;
    const mergeTokenPortalAddress = process.env.CONTRACTS_MERGE_TOKEN_PORTAL_ADDR;
    const constructorArguments = [chainId, mergeTokenPortalAddress];
    await verifyPromise(process.env.CONTRACTS_L2_SHARED_BRIDGE_IMPL_ADDR, constructorArguments);
  });
  await program.parseAsync(process.argv);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
