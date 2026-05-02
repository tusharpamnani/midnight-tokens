import 'dotenv/config';
import * as fs from 'node:fs';
import { deploy } from './deploy.js';
import { getOwnedTokens } from './state.js';
import { ensureCompiledArtifacts } from './check-artifacts.js';
import {
  balanceOfFungible,
  mintFungible,
  totalSupplyFungible,
  transferFungible,
} from './fungible.js';
import { createWallet } from './utils.js';

function getDeployment() {
  if (!fs.existsSync('deployment.json')) {
    console.error('No deployment.json found! Run `deploy` first.');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync('deployment.json', 'utf-8'));
}

async function main() {
  ensureCompiledArtifacts();

  const args = process.argv.slice(2);
  const command = args[0];

  if (!command) {
    console.log(`
Midnight Token CLI

Usage:
  npm run cli -- <command> [args]

Commands:
  deploy                        Deploy the base contract
  balance                       Show owned items from local state
  wallet-info                   Print wallet addresses/keys
  mint <to> <amount>            Mint fungible tokens
  transfer <to> <amount>        Transfer fungible tokens
  balance-of <account>          Query token balance
  total-supply                  Query total token supply

Recipient format:
  coin:<64-hex>                 Zswap coin public key (wallet)
  contract:<64-hex>             Contract address
  <64-hex>                      Defaults to coin:<64-hex>
    `);
    process.exit(0);
  }

  // Expect PRIVATE_STATE_PASSWORD to be in env, or supply it
  if (!process.env.PRIVATE_STATE_PASSWORD) {
    process.env.PRIVATE_STATE_PASSWORD = 'Str0ng!MidnightLocal';
  }

  try {
    switch (command) {
      case 'deploy': {
        const seed =
          process.env.WALLET_SEED ||
          '0000000000000000000000000000000000000000000000000000000000000001'; // For testing or user has to set it
        console.log(`Using seed starting with ${seed.substring(0, 4)}...`);
        await deploy(seed);
        break;
      }

      case 'wallet-info': {
        const deployment = fs.existsSync('deployment.json')
          ? getDeployment()
          : null;
        const seed =
          deployment?.seed ||
          '0000000000000000000000000000000000000000000000000000000000000001';

        const walletCtx = await createWallet(seed);
        const state = await walletCtx.wallet.waitForSyncedState();

        console.log('Wallet Info');
        console.log('──────────────────────────────────────────────────');
        console.log(`Unshielded address: ${walletCtx.unshieldedKeystore.getBech32Address().toString()}`);
        console.log(`Coin public key:    ${state.shielded.coinPublicKey.toHexString()}`);
        console.log(`Enc public key:     ${state.shielded.encryptionPublicKey.toHexString()}`);
        console.log('──────────────────────────────────────────────────');

        await walletCtx.wallet.stop();
        break;
      }

      case 'mint': {
        const to = args[1];
        const amountStr = args[2];
        if (!to || !amountStr) {
          console.error('Usage: npm run cli -- mint <to> <amount>');
          process.exit(1);
        }

        const deployment = getDeployment();
        const seed = process.env.WALLET_SEED || deployment.seed;
        const amount = BigInt(amountStr);

        await mintFungible({
          seed,
          contractAddress: deployment.contractAddress,
          to,
          amount,
        });
        break;
      }

      case 'transfer': {
        const to = args[1];
        const amountStr = args[2];
        if (!to || !amountStr) {
          console.error('Usage: npm run cli -- transfer <to> <amount>');
          process.exit(1);
        }

        const deployment = getDeployment();
        const seed = process.env.WALLET_SEED || deployment.seed;
        const amount = BigInt(amountStr);

        await transferFungible({
          seed,
          contractAddress: deployment.contractAddress,
          to,
          amount,
        });
        break;
      }

      case 'balance-of': {
        const account = args[1];
        if (!account) {
          console.error('Usage: npm run cli -- balance-of <account>');
          process.exit(1);
        }

        const deployment = getDeployment();
        const seed = process.env.WALLET_SEED || deployment.seed;

        await balanceOfFungible({
          seed,
          contractAddress: deployment.contractAddress,
          account,
        });
        break;
      }

      case 'total-supply': {
        const deployment = getDeployment();
        const seed = process.env.WALLET_SEED || deployment.seed;

        await totalSupplyFungible({
          seed,
          contractAddress: deployment.contractAddress,
        });
        break;
      }

      case 'balance': {
        const tokens = getOwnedTokens();
        console.log('\nOwned Tokens:');
        console.log('──────────────────────────────────────────────────');
        for (const [id, data] of Object.entries(tokens)) {
          console.log(`ID: ${id}`);
          console.log(`Metadata: ${data.metadata}`);
          console.log(`Metadata Hash: ${data.metadataHash}`);
          console.log('──────────────────────────────────────────────────');
        }
        if (Object.keys(tokens).length === 0) {
          console.log('No tokens found in local state.');
        }
        break;
      }

      default:
        console.error(`Unknown command: ${command}`);
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error executing command:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
