import 'dotenv/config';
import * as fs from 'node:fs';
import { deploy } from './deploy.js';
import { getOwnedTokens } from './state.js';
import { ensureCompiledArtifacts } from './check-artifacts.js';

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
Midnight NFT CLI

Usage:
  npm run cli -- <command> [args]

Commands:
  deploy                        Deploy the base contract
  balance                       Show owned items from local state
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
        const seed = process.env.WALLET_SEED || '0000000000000000000000000000000000000000000000000000000000000000'; // For testing or user has to set it
        console.log(`Using seed starting with ${seed.substring(0, 4)}...`);
        await deploy(seed);
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
