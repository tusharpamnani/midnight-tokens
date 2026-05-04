import 'dotenv/config';
import * as fs from 'node:fs';

import { ensureCompiledArtifacts } from './check-artifacts.js';
import { deploy } from './deploy.js';
import { createWallet } from './utils.js';
import {
  balanceOfFungible,
  burnFungible,
  finishMintingFungible,
  maxSupplyFungible,
  mintFungible,
  mintingFinishedFungible,
  ownerFungible,
  totalSupplyFungible,
  transferFungible,
  transferOwnershipFungible,
} from './fungible.js';
import {
  deployFactory,
  factoryTokenAt,
  factoryTokenCount,
  factoryTokenMetadata,
  registerTokenInFactory,
} from './factory.js';
import { verify } from './verify.js';

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
  deploy [name] [symbol] [decimals] [initial] [max]
  verify                              Verify deployment.json contract schema
  smoke                               Verify + read basic token stats
  wallet-info                         Print wallet addresses/keys

  mint <to> <amount>                  Mint tokens (owner only)
  finish-minting                      Permanently stop minting (owner only)
  burn <amount>                       Burn tokens from caller
  transfer <to> <amount>              Transfer tokens

  balance-of <account>                Query balance
  total-supply                        Query total supply
  owner                               Query owner coin public key
  max-supply                           Query max supply
  minting-finished                    Query mintingFinished flag
  transfer-ownership <coinPubKeyHex>  Transfer ownership (owner only)

  (use --token <address> to target a specific token contract)

Factory (registry) commands:
  deploy-factory
  factory-count <factory>
  factory-token-at <factory> <i>
  factory-meta <factory> <token>
  factory-register <factory> <token> <name> <symbol> <supply> [imageUri] [description]

Recipient format:
  coin:<64-hex>                 Zswap coin public key (wallet)
  contract:<64-hex>             Contract address
  <64-hex>                      Defaults to coin:<64-hex>
    `);
    process.exit(0);
  }

  if (!process.env.PRIVATE_STATE_PASSWORD) {
    process.env.PRIVATE_STATE_PASSWORD = 'Str0ng!MidnightLocal';
  }

  try {
    switch (command) {
      case 'deploy': {
        const seed =
          process.env.WALLET_SEED ||
          '0000000000000000000000000000000000000000000000000000000000000001';
      
        const name = args[1] ?? 'Nikku';
        const symbol = args[2] ?? 'NTK';
        const decimals = BigInt(args[3] ?? '18');
        const initialSupply = BigInt(args[4] ?? '1000000');
        const maxSupply = BigInt(args[5] ?? args[4] ?? '1000000');
      
        console.log(`Using seed starting with ${seed.substring(0, 4)}...`);
      
        await deploy({
          seed,
          name,
          symbol,
          decimals,
          initialSupply,
          maxSupply,
        });
      
        break;
      }

      case 'verify': {
        const deployment = getDeployment();
        const seed = process.env.WALLET_SEED || deployment.seed;
        if (!seed) {
          console.error('Missing seed. Set WALLET_SEED or ensure deployment.json includes a seed.');
          process.exit(1);
        }
        await verify({ seed, contractAddress: tokenOverride || deployment.contractAddress });
        break;
      }

      case 'smoke': {
        const deployment = getDeployment();
        const seed = process.env.WALLET_SEED || deployment.seed;
        if (!seed) {
          console.error('Missing seed. Set WALLET_SEED or ensure deployment.json includes a seed.');
          process.exit(1);
        }
        const contractAddress = tokenOverride || deployment.contractAddress;
        await verify({ seed, contractAddress });
        await totalSupplyFungible({ seed, contractAddress });
        await maxSupplyFungible({ seed, contractAddress });
        await mintingFinishedFungible({ seed, contractAddress });
        await ownerFungible({ seed, contractAddress });
        break;
      }

      case 'wallet-info': {
        const deployment = fs.existsSync('deployment.json') ? getDeployment() : null;
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
          console.error('Usage: npm run cli -- mint <to> <amount> [--token <address>]');
          process.exit(1);
        }
        const deployment = getDeployment();
        const seed = process.env.WALLET_SEED || deployment.seed;
        const contractAddress = tokenOverride || deployment.contractAddress;
        await mintFungible({ seed, contractAddress, to, amount: BigInt(amountStr) });
        break;
      }

      case 'finish-minting': {
        const deployment = getDeployment();
        const seed = process.env.WALLET_SEED || deployment.seed;
        const contractAddress = tokenOverride || deployment.contractAddress;
        await finishMintingFungible({ seed, contractAddress });
        break;
      }

      case 'burn': {
        const amountStr = args[1];
        if (!amountStr) {
          console.error('Usage: npm run cli -- burn <amount> [--token <address>]');
          process.exit(1);
        }
        const deployment = getDeployment();
        const seed = process.env.WALLET_SEED || deployment.seed;
        const contractAddress = tokenOverride || deployment.contractAddress;
        await burnFungible({ seed, contractAddress, amount: BigInt(amountStr) });
        break;
      }

      case 'transfer': {
        const to = args[1];
        const amountStr = args[2];
        if (!to || !amountStr) {
          console.error('Usage: npm run cli -- transfer <to> <amount> [--token <address>]');
          process.exit(1);
        }
        const deployment = getDeployment();
        const seed = process.env.WALLET_SEED || deployment.seed;
        const contractAddress = tokenOverride || deployment.contractAddress;
        await transferFungible({ seed, contractAddress, to, amount: BigInt(amountStr) });
        break;
      }

      case 'balance-of': {
        const account = args[1];
        if (!account) {
          console.error('Usage: npm run cli -- balance-of <account> [--token <address>]');
          process.exit(1);
        }
        const deployment = getDeployment();
        const seed = process.env.WALLET_SEED || deployment.seed;
        const contractAddress = tokenOverride || deployment.contractAddress;
        await balanceOfFungible({ seed, contractAddress, account });
        break;
      }

      case 'total-supply': {
        const deployment = getDeployment();
        const seed = process.env.WALLET_SEED || deployment.seed;
        const contractAddress = tokenOverride || deployment.contractAddress;
        await totalSupplyFungible({ seed, contractAddress });
        break;
      }

      case 'owner': {
        const deployment = getDeployment();
        const seed = process.env.WALLET_SEED || deployment.seed;
        const contractAddress = tokenOverride || deployment.contractAddress;
        await ownerFungible({ seed, contractAddress });
        break;
      }

      case 'max-supply': {
        const deployment = getDeployment();
        const seed = process.env.WALLET_SEED || deployment.seed;
        const contractAddress = tokenOverride || deployment.contractAddress;
        await maxSupplyFungible({ seed, contractAddress });
        break;
      }

      case 'minting-finished': {
        const deployment = getDeployment();
        const seed = process.env.WALLET_SEED || deployment.seed;
        const contractAddress = tokenOverride || deployment.contractAddress;
        await mintingFinishedFungible({ seed, contractAddress });
        break;
      }

      case 'transfer-ownership': {
        const newOwner = args[1];
        if (!newOwner) {
          console.error('Usage: npm run cli -- transfer-ownership <coinPublicKeyHex> [--token <address>]');
          process.exit(1);
        }
        const deployment = getDeployment();
        const seed = process.env.WALLET_SEED || deployment.seed;
        const contractAddress = tokenOverride || deployment.contractAddress;
        await transferOwnershipFungible({ seed, contractAddress, newOwnerCoinPublicKey: newOwner });
        break;
      }

      case 'deploy-factory': {
        const deployment = fs.existsSync('deployment.json') ? getDeployment() : null;
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
