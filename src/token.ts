import crypto from 'node:crypto';
import { deployContract } from '@midnight-ntwrk/midnight-js-contracts';
import { createProviders, createWallet, getCompiledContract } from './utils.js';

function getCallerAddressBytes(bech32Address: string) {
  return crypto.createHash('sha256').update(bech32Address).digest();
}

export async function deployTokenWithArgs(params: {
  seed: string;
  name: string;
  symbol: string;
  decimals: bigint;
  initialSupply: bigint;
}) {
  const walletCtx = await createWallet(params.seed);
  await walletCtx.wallet.waitForSyncedState();

  const walletAddressString = walletCtx.unshieldedKeystore.getBech32Address().toString();
  const callerAddressBytes = getCallerAddressBytes(walletAddressString);

  const providers = await createProviders(walletCtx);

  const deployed = await deployContract(providers, {
    compiledContract: getCompiledContract(callerAddressBytes),
    args: [params.name, params.symbol, params.decimals, params.initialSupply],
  });

  const contractAddress = deployed.deployTxData.public.contractAddress as unknown as string;
  console.log(`✅ Token deployed: ${contractAddress}`);

  await walletCtx.wallet.stop();
  return contractAddress;
}

