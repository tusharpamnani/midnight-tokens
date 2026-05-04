import * as fs from 'node:fs';
import { deployContract } from '@midnight-ntwrk/midnight-js-contracts';
import { createWallet, createProviders, getCompiledContract } from './utils.js';
import * as path from 'node:path';

export async function deploy(params: {
  seed: string;
  name: string;
  symbol: string;
  decimals: bigint;
  initialSupply: bigint;
  maxSupply: bigint;
}) {
  console.log('Connecting and syncing wallet...');
  const walletCtx = await createWallet(params.seed);
  await walletCtx.wallet.waitForSyncedState();

console.log('Setting up providers...');
const providers = await createProviders(walletCtx); // uses FUNGIBLE_CONTRACT_PATH by default

  // Load the token contract asynchronously
  console.log('Compiling contract assets...');
  const compiled = await getCompiledContract('token');

  console.log('Deploying contract (this may take 30-60 seconds)...');
  const deployed = await deployContract(providers, {
    compiledContract: compiled,
    args: [params.name, params.symbol, params.decimals, params.initialSupply, params.maxSupply],
  });

  const contractAddress = deployed.deployTxData.public.contractAddress;
  console.log('✅ Contract deployed successfully!');
  console.log(`Contract Address: ${contractAddress}`);

  const deploymentInfo = {
    contractAddress,
    seed: params.seed,
    network: process.env.MIDNIGHT_NETWORK_ID?.trim() || 'undeployed',
    deployedAt: new Date().toISOString(),
    schema: 'fungible-v1',
  };

  fs.writeFileSync('deployment.json', JSON.stringify(deploymentInfo, null, 2));
  console.log('Saved to deployment.json');
  
  await walletCtx.wallet.stop();
}