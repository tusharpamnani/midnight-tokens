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
import {
  deployFactory,
  factoryTokenAt,
  factoryTokenCount,
  factoryTokenMetadata,
  registerTokenInFactory,
} from './factory.js';
import { deployTokenWithArgs } from './token.js';

function getDeployment() {
  if (!fs.existsSync('deployment.json')) {
    console.error('No deployment.json found! Run `deploy` first.');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync('deployment.json', 'utf-8'));
}

function readFlagValue(args: string[], flag: string) {
  const idx = args.indexOf(flag);
  if (idx === -1) return { value: null as string | null, args };
  const value = args[idx + 1];
  const nextArgs = args.slice(0, idx).concat(args.slice(idx + 2));
  return { value: value ?? null, args: nextArgs };
}

async function main() {
  ensureCompiledArtifacts();

  let args = process.argv.slice(2);
  const command = args[0];
  const tokenFlag = readFlagValue(args, '--token');
  args = tokenFlag.args;
  const tokenOverride = tokenFlag.value;

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
  (use --token <addressHex> to target a specific token)
  deploy-factory                Deploy token registry ("factory")
  factory-count <factory>       Query factory token count
  factory-token-at <factory> <i>  Get token at index
  factory-meta <factory> <token>  Get stored token metadata (json)
  factory-register <factory> <token> <name> <symbol> <supply> [imageUri] [description]
  factory-create-token <factory> <name> <symbol> <decimals> <supply> [imageUri] [description]

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
          process.env.WALLET_SEED ||
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
        const contractAddress = tokenOverride || deployment.contractAddress;

        await mintFungible({
          seed,
          contractAddress,
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
        const contractAddress = tokenOverride || deployment.contractAddress;

        await transferFungible({
          seed,
          contractAddress,
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
        const contractAddress = tokenOverride || deployment.contractAddress;

        await balanceOfFungible({
          seed,
          contractAddress,
          account,
        });
        break;
      }

      case 'total-supply': {
        const deployment = getDeployment();
        const seed = process.env.WALLET_SEED || deployment.seed;
        const contractAddress = tokenOverride || deployment.contractAddress;

        await totalSupplyFungible({
          seed,
          contractAddress,
        });
        break;
      }

      case 'deploy-factory': {
        const deployment = fs.existsSync('deployment.json')
          ? getDeployment()
          : null;
        const seed =
          process.env.WALLET_SEED ||
          deployment?.seed ||
          '0000000000000000000000000000000000000000000000000000000000000001';

        const factoryAddress = await deployFactory(seed);
        fs.writeFileSync(
          'factory-deployment.json',
          JSON.stringify(
            {
              factoryAddress,
              seed,
              network: process.env.MIDNIGHT_NETWORK_ID?.trim() || 'preprod',
              deployedAt: new Date().toISOString(),
            },
            null,
            2,
          ),
        );
        console.log('Saved to factory-deployment.json');
        break;
      }

      case 'factory-count': {
        const factory = args[1];
        if (!factory) {
          console.error('Usage: npm run cli -- factory-count <factoryAddress>');
          process.exit(1);
        }
        const deployment = getDeployment();
        const seed = process.env.WALLET_SEED || deployment.seed;
        await factoryTokenCount({ seed, factoryAddress: factory });
        break;
      }

      case 'factory-token-at': {
        const factory = args[1];
        const indexStr = args[2];
        if (!factory || !indexStr) {
          console.error('Usage: npm run cli -- factory-token-at <factoryAddress> <index>');
          process.exit(1);
        }
        const deployment = getDeployment();
        const seed = process.env.WALLET_SEED || deployment.seed;
        await factoryTokenAt({ seed, factoryAddress: factory, index: BigInt(indexStr) });
        break;
      }

      case 'factory-meta': {
        const factory = args[1];
        const token = args[2];
        if (!factory || !token) {
          console.error('Usage: npm run cli -- factory-meta <factoryAddress> <tokenAddressHex>');
          process.exit(1);
        }
        const deployment = getDeployment();
        const seed = process.env.WALLET_SEED || deployment.seed;
        await factoryTokenMetadata({ seed, factoryAddress: factory, tokenAddress: token });
        break;
      }

      case 'factory-register': {
        const factory = args[1];
        const token = args[2];
        const name = args[3];
        const symbol = args[4];
        const supplyStr = args[5];
        const imageUri = args[6] || '';
        const description = args[7] || '';
        if (!factory || !token || !name || !symbol || !supplyStr) {
          console.error(
            'Usage: npm run cli -- factory-register <factoryAddress> <tokenAddressHex> <name> <symbol> <supply> [imageUri] [description]',
          );
          process.exit(1);
        }

        const deployment = getDeployment();
        const seed = process.env.WALLET_SEED || deployment.seed;

        await registerTokenInFactory({
          seed,
          factoryAddress: factory,
          tokenAddress: token,
          name,
          symbol,
          imageUri,
          description,
          totalSupply: BigInt(supplyStr),
        });
        break;
      }

      case 'factory-create-token': {
        const factory = args[1];
        const name = args[2];
        const symbol = args[3];
        const decimalsStr = args[4];
        const supplyStr = args[5];
        const imageUri = args[6] || '';
        const description = args[7] || '';
        if (!factory || !name || !symbol || !decimalsStr || !supplyStr) {
          console.error(
            'Usage: npm run cli -- factory-create-token <factoryAddress> <name> <symbol> <decimals> <supply> [imageUri] [description]',
          );
          process.exit(1);
        }

        const deployment = getDeployment();
        const seed = process.env.WALLET_SEED || deployment.seed;
        const decimals = BigInt(decimalsStr);
        const supply = BigInt(supplyStr);

        const tokenAddress = await deployTokenWithArgs({
          seed,
          name,
          symbol,
          decimals,
          initialSupply: supply,
        });

        // tokenAddress is returned as hex string. Register expects 64 hex chars.
        await registerTokenInFactory({
          seed,
          factoryAddress: factory,
          tokenAddress: tokenAddress.replace(/^0x/i, ''),
          name,
          symbol,
          imageUri,
          description,
          totalSupply: supply,
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
