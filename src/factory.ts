import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';

import {
  createUnprovenCallTx,
  deployContract,
  findDeployedContract,
} from '@midnight-ntwrk/midnight-js-contracts';

import { toHex } from '@midnight-ntwrk/midnight-js-utils';
import { createProviders, createWallet, getCompiledContract } from './utils.js';

type ContractAddress = { bytes: Uint8Array };
type ZswapCoinPublicKey = { bytes: Uint8Array };

function hexToBytes32(hex: string) {
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(
      `Expected 32-byte hex string (64 hex chars), got: ${hex.length} chars`,
    );
  }
  return Uint8Array.from(Buffer.from(hex, 'hex'));
}

export function parseContractAddressHex(hex: string): ContractAddress {
  return { bytes: hexToBytes32(hex.trim()) };
}

function bytesToUtf8(bytes: Uint8Array) {
  return Buffer.from(bytes).toString('utf8').replace(/\0+$/, '');
}

function padBytes(spec: string, length: number) {
  const buf = Buffer.alloc(length);
  buf.write(spec);
  return Uint8Array.from(buf);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const factoryZkPath = path.resolve(__dirname, '..', 'contracts', 'managed', 'factory');

export async function deployFactory(seed: string) {
  const walletCtx = await createWallet(seed);
  await walletCtx.wallet.waitForSyncedState();

  const providers = await createProviders(walletCtx, factoryZkPath);
  
  // FIXED: Using the async utility and passing 'factory' identifier
  const compiledFactory = await getCompiledContract('factory');

  const deployed = await deployContract(providers, {
    compiledContract: compiledFactory,
    args: [],
  });

  const contractAddress =
    deployed.deployTxData.public.contractAddress as unknown as string;

  console.log('✅ Factory deployed successfully!');
  console.log(`Factory Address: ${contractAddress}`);

  await walletCtx.wallet.stop();
  return contractAddress;
}

export async function registerTokenInFactory(params: {
  seed: string;
  factoryAddress: string;
  tokenAddress: string;
  name: string;
  symbol: string;
  imageUri: string;
  description: string;
  totalSupply: bigint;
}) {
  const walletCtx = await createWallet(params.seed);
  await walletCtx.wallet.waitForSyncedState();

  const providers = await createProviders(walletCtx, factoryZkPath);
  // FIXED: Using the async utility
  const compiledFactory = await getCompiledContract('factory');

  const factory = await findDeployedContract(providers as any, {
    contractAddress: params.factoryAddress,
    compiledContract: compiledFactory,
  });

  const token = parseContractAddressHex(params.tokenAddress);

  const tx = await (factory as any).callTx.registerToken(
    token,
    padBytes(params.name, 32),
    padBytes(params.symbol, 16),
    padBytes(params.imageUri, 64),
    padBytes(params.description, 128),
    params.totalSupply,
  );

  console.log('✅ Token registered in factory!');
  console.log(`Transaction: ${tx.public.txId}`);

  await walletCtx.wallet.stop();
}

export async function factoryTokenCount(params: { seed: string; factoryAddress: string }) {
  const walletCtx = await createWallet(params.seed);
  await walletCtx.wallet.waitForSyncedState();
  const providers = await createProviders(walletCtx, factoryZkPath);
  // FIXED: Using the async utility
  const compiledFactory = await getCompiledContract('factory');

  const callData = await createUnprovenCallTx(providers as any, {
    compiledContract: compiledFactory,
    circuitId: 'tokenCount' as any,
    contractAddress: params.factoryAddress as any,
    args: [],
  });
  console.log(`${callData.private.result}`);
  await walletCtx.wallet.stop();
}

export async function factoryTokenAt(params: {
  seed: string;
  factoryAddress: string;
  index: bigint;
}) {
  const walletCtx = await createWallet(params.seed);
  await walletCtx.wallet.waitForSyncedState();
  const providers = await createProviders(walletCtx, factoryZkPath);
  // FIXED: Using the async utility
  const compiledFactory = await getCompiledContract('factory');

  const callData = await createUnprovenCallTx(providers as any, {
    compiledContract: compiledFactory,
    circuitId: 'tokenAt' as any,
    contractAddress: params.factoryAddress as any,
    args: [params.index],
  });

  const token = callData.private.result as ContractAddress;
  console.log(toHex(token.bytes));
  await walletCtx.wallet.stop();
}

export async function factoryTokenMetadata(params: {
  seed: string;
  factoryAddress: string;
  tokenAddress: string;
}) {
  const walletCtx = await createWallet(params.seed);
  await walletCtx.wallet.waitForSyncedState();
  const providers = await createProviders(walletCtx, factoryZkPath);
  // FIXED: Using the async utility
  const compiledFactory = await getCompiledContract('factory');

  const token = parseContractAddressHex(params.tokenAddress);

  async function query(circuitId: string, args: any[]) {
    const callData = await createUnprovenCallTx(providers as any, {
      compiledContract: compiledFactory,
      circuitId: circuitId as any,
      contractAddress: params.factoryAddress as any,
      args,
    });
    return callData.private.result as any;
  }

  const name = bytesToUtf8((await query('nameOf', [token])) as Uint8Array);
  const symbol = bytesToUtf8((await query('symbolOf', [token])) as Uint8Array);
  const imageUri = bytesToUtf8((await query('imageUriOf', [token])) as Uint8Array);
  const description = bytesToUtf8((await query('descriptionOf', [token])) as Uint8Array);
  const creator = (await query('creatorOf', [token])) as ZswapCoinPublicKey;
  const totalSupply = await query('totalSupplyOf', [token]);
  const active = await query('isActive', [token]);

  console.log(JSON.stringify({
    token: params.tokenAddress,
    name,
    symbol,
    imageUri,
    description,
    creatorCoinPublicKey: toHex(creator.bytes),
    totalSupply: `${totalSupply}`,
    active: Boolean(active),
  }, null, 2));

  await walletCtx.wallet.stop();
}