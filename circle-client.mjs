import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import { initiateSmartContractPlatformClient } from "@circle-fin/smart-contract-platform";
const K = process.env["CIRCLE_API_KEY"];
const S = process.env["CIRCLE_ENTITY_SECRET"];
export const dcw = initiateDeveloperControlledWalletsClient({ apiKey: K, entitySecret: S });
export const scp = initiateSmartContractPlatformClient({ apiKey: K, entitySecret: S });
