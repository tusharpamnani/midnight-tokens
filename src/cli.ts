import 'dotenv/config';
import * as fs from 'node:fs';
import { deploy } from './deploy.js';
import { getOwnedTokens } from './state.js';
import { ensureCompiledArtifacts } from './check-artifacts.js';
import {
  buyLaunchpad,
  deactivateLaunchpad,
  endSaleLaunchpad,
  launchpadBuyersOf,
  launchpadCreatorOf,
  launchpadIsSaleActive,
  launchpadPriceOf,
  launchpadRaisedOf,
  launchpadTokenAt,
  launchpadTokenCount,
  launchpadVolumeOf,
  registerTokenLaunchpad,
  setMetadataLaunchpad,
  startSaleLaunchpad,
} from './launchpad.js';
import { createWallet } from './utils.js';
import {
  deployFactory,
  factoryTokenAt,
  factoryTokenCount,
  factoryTokenMetadata,
  registerTokenInFactory,
} from './factory.js';

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
  deploy                        Deploy the launchpad contract
  balance                       Show owned items from local state
  wallet-info                   Print wallet addresses/keys
  lp-register <token> <name> <symbol> <supply> [imageUri] [description]
                               Register a token in the launchpad
  lp-start-sale <token> <price> Start token sale
  lp-buy <token> <amount>       Buy during token sale
  lp-end-sale <token>           End token sale
  lp-set-metadata <token> [imageUri] [description]
                               Update stored metadata
  lp-deactivate <token>         Deactivate token
  lp-count                      Query launchpad token count
  lp-token-at <i>               Get token at index
  lp-price <token>              Query current price
  lp-raised <token>             Query raised amount (net)
  lp-volume <token>             Query volume
  lp-buyers <token>             Query buyers count
  lp-sale-active <token>        Query sale active flag
  lp-creator <token>            Query creator coin public key
  deploy-factory                Deploy token registry ("factory")
  factory-count <factory>       Query factory token count
  factory-token-at <factory> <i>  Get token at index
  factory-meta <factory> <token>  Get stored token metadata (json)
  factory-register <factory> <token> <name> <symbol> <supply> [imageUri] [description]
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
        console.error('Command removed: mint (the on-chain contract no longer exposes mint).');
        process.exit(1);
      }

      case 'transfer': {
        console.error('Command removed: transfer (the on-chain contract no longer exposes transfer).');
        process.exit(1);
      }

      case 'balance-of': {
        console.error('Command removed: balance-of (the on-chain contract no longer exposes balances).');
        process.exit(1);
      }

      case 'total-supply': {
        console.error('Command removed: total-supply (the on-chain contract no longer exposes totalSupply).');
        process.exit(1);
      }

      case 'lp-register': {
        const token = args[1];
        const name = args[2];
        const symbol = args[3];
        const supplyStr = args[4];
        const imageUri = args[5] || '';
        const description = args[6] || '';
        if (!token || !name || !symbol || !supplyStr) {
          console.error(
            'Usage: npm run cli -- lp-register <tokenAddressHex> <name> <symbol> <supply> [imageUri] [description]',
          );
          process.exit(1);
        }

        const deployment = getDeployment();
        const seed = process.env.WALLET_SEED || deployment.seed;

        await registerTokenLaunchpad({
          seed,
          launchpadAddress: deployment.contractAddress,
          tokenAddress: token,
          name,
          symbol,
          imageUri,
          description,
          totalSupply: BigInt(supplyStr),
        });
        break;
      }

      case 'lp-start-sale': {
        const token = args[1];
        const priceStr = args[2];
        if (!token || !priceStr) {
          console.error('Usage: npm run cli -- lp-start-sale <tokenAddressHex> <price>');
          process.exit(1);
        }
        const deployment = getDeployment();
        const seed = process.env.WALLET_SEED || deployment.seed;
        await startSaleLaunchpad({
          seed,
          launchpadAddress: deployment.contractAddress,
          tokenAddress: token,
          price: BigInt(priceStr),
        });
        break;
      }

      case 'lp-buy': {
        const token = args[1];
        const amountStr = args[2];
        if (!token || !amountStr) {
          console.error('Usage: npm run cli -- lp-buy <tokenAddressHex> <amount>');
          process.exit(1);
        }
        const deployment = getDeployment();
        const seed = process.env.WALLET_SEED || deployment.seed;
        await buyLaunchpad({
          seed,
          launchpadAddress: deployment.contractAddress,
          tokenAddress: token,
          amount: BigInt(amountStr),
        });
        break;
      }

      case 'lp-end-sale': {
        const token = args[1];
        if (!token) {
          console.error('Usage: npm run cli -- lp-end-sale <tokenAddressHex>');
          process.exit(1);
        }
        const deployment = getDeployment();
        const seed = process.env.WALLET_SEED || deployment.seed;
        await endSaleLaunchpad({
          seed,
          launchpadAddress: deployment.contractAddress,
          tokenAddress: token,
        });
        break;
      }

      case 'lp-set-metadata': {
        const token = args[1];
        const imageUri = args[2] || '';
        const description = args[3] || '';
        if (!token) {
          console.error('Usage: npm run cli -- lp-set-metadata <tokenAddressHex> [imageUri] [description]');
          process.exit(1);
        }
        const deployment = getDeployment();
        const seed = process.env.WALLET_SEED || deployment.seed;
        await setMetadataLaunchpad({
          seed,
          launchpadAddress: deployment.contractAddress,
          tokenAddress: token,
          imageUri,
          description,
        });
        break;
      }

      case 'lp-deactivate': {
        const token = args[1];
        if (!token) {
          console.error('Usage: npm run cli -- lp-deactivate <tokenAddressHex>');
          process.exit(1);
        }
        const deployment = getDeployment();
        const seed = process.env.WALLET_SEED || deployment.seed;
        await deactivateLaunchpad({
          seed,
          launchpadAddress: deployment.contractAddress,
          tokenAddress: token,
        });
        break;
      }

      case 'lp-count': {
        const deployment = getDeployment();
        const seed = process.env.WALLET_SEED || deployment.seed;
        await launchpadTokenCount({ seed, launchpadAddress: deployment.contractAddress });
        break;
      }

      case 'lp-token-at': {
        const indexStr = args[1];
        if (!indexStr) {
          console.error('Usage: npm run cli -- lp-token-at <index>');
          process.exit(1);
        }
        const deployment = getDeployment();
        const seed = process.env.WALLET_SEED || deployment.seed;
        await launchpadTokenAt({
          seed,
          launchpadAddress: deployment.contractAddress,
          index: BigInt(indexStr),
        });
        break;
      }

      case 'lp-price': {
        const token = args[1];
        if (!token) {
          console.error('Usage: npm run cli -- lp-price <tokenAddressHex>');
          process.exit(1);
        }
        const deployment = getDeployment();
        const seed = process.env.WALLET_SEED || deployment.seed;
        await launchpadPriceOf({ seed, launchpadAddress: deployment.contractAddress, tokenAddress: token });
        break;
      }

      case 'lp-raised': {
        const token = args[1];
        if (!token) {
          console.error('Usage: npm run cli -- lp-raised <tokenAddressHex>');
          process.exit(1);
        }
        const deployment = getDeployment();
        const seed = process.env.WALLET_SEED || deployment.seed;
        await launchpadRaisedOf({ seed, launchpadAddress: deployment.contractAddress, tokenAddress: token });
        break;
      }

      case 'lp-volume': {
        const token = args[1];
        if (!token) {
          console.error('Usage: npm run cli -- lp-volume <tokenAddressHex>');
          process.exit(1);
        }
        const deployment = getDeployment();
        const seed = process.env.WALLET_SEED || deployment.seed;
        await launchpadVolumeOf({ seed, launchpadAddress: deployment.contractAddress, tokenAddress: token });
        break;
      }

      case 'lp-buyers': {
        const token = args[1];
        if (!token) {
          console.error('Usage: npm run cli -- lp-buyers <tokenAddressHex>');
          process.exit(1);
        }
        const deployment = getDeployment();
        const seed = process.env.WALLET_SEED || deployment.seed;
        await launchpadBuyersOf({ seed, launchpadAddress: deployment.contractAddress, tokenAddress: token });
        break;
      }

      case 'lp-sale-active': {
        const token = args[1];
        if (!token) {
          console.error('Usage: npm run cli -- lp-sale-active <tokenAddressHex>');
          process.exit(1);
        }
        const deployment = getDeployment();
        const seed = process.env.WALLET_SEED || deployment.seed;
        await launchpadIsSaleActive({ seed, launchpadAddress: deployment.contractAddress, tokenAddress: token });
        break;
      }

      case 'lp-creator': {
        const token = args[1];
        if (!token) {
          console.error('Usage: npm run cli -- lp-creator <tokenAddressHex>');
          process.exit(1);
        }
        const deployment = getDeployment();
        const seed = process.env.WALLET_SEED || deployment.seed;
        await launchpadCreatorOf({ seed, launchpadAddress: deployment.contractAddress, tokenAddress: token });
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
