import crypto from 'node:crypto';
import { createUnprovenCallTx, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { createProviders, createWallet, getCompiledContract } from './utils.js';

type RecipientEither = {
  is_left: boolean;
  left: { bytes: Uint8Array };
  right: { bytes: Uint8Array };
};

function isHex32Bytes(value: string) {
  return /^[0-9a-fA-F]{64}$/.test(value);
}

function hexToBytes32(hex: string) {
  if (!isHex32Bytes(hex)) {
    throw new Error(
      `Expected 32-byte hex string (64 hex chars), got: ${hex.length} chars`,
    );
  }
  return Uint8Array.from(Buffer.from(hex, 'hex'));
}

export function parseRecipient(spec: string): RecipientEither {
  const trimmed = spec.trim();

  if (trimmed.startsWith('coin:')) {
    const bytes = hexToBytes32(trimmed.slice('coin:'.length));
    return { is_left: true, left: { bytes }, right: { bytes: new Uint8Array(32) } };
  }

  if (trimmed.startsWith('contract:')) {
    const bytes = hexToBytes32(trimmed.slice('contract:'.length));
    return { is_left: false, left: { bytes: new Uint8Array(32) }, right: { bytes } };
  }

  // Default: treat as Zswap coin public key (most common for wallets).
  if (isHex32Bytes(trimmed)) {
    const bytes = hexToBytes32(trimmed);
    return { is_left: true, left: { bytes }, right: { bytes: new Uint8Array(32) } };
  }

  throw new Error(
    'Invalid recipient format. Use one of:\n' +
      '  coin:<64-hex>      (Zswap coin public key)\n' +
      '  contract:<64-hex>  (contract address)\n' +
      '  <64-hex>           (defaults to coin public key)',
  );
}

function getCallerAddressBytes(bech32Address: string) {
  return crypto.createHash('sha256').update(bech32Address).digest();
}

export async function mintFungible(params: {
  seed: string;
  contractAddress: string;
  to: string;
  amount: bigint;
}) {
  const walletCtx = await createWallet(params.seed);
  await walletCtx.wallet.waitForSyncedState();

  const walletAddressString = walletCtx.unshieldedKeystore.getBech32Address().toString();
  const callerAddressBytes = getCallerAddressBytes(walletAddressString);
  const compiledContract = getCompiledContract(callerAddressBytes);
  const providers = await createProviders(walletCtx);

  const contract = await findDeployedContract(providers, {
    contractAddress: params.contractAddress,
    compiledContract,
  });

  const toEither = parseRecipient(params.to);

  console.log(`Minting ${params.amount} to ${params.to}...`);
  const tx = await (contract as any).callTx.mint(toEither, params.amount);
  console.log('✅ Mint submitted!');
  console.log(`Transaction: ${tx.public.txId}`);

  await walletCtx.wallet.stop();
}

export async function transferFungible(params: {
  seed: string;
  contractAddress: string;
  to: string;
  amount: bigint;
}) {
  const walletCtx = await createWallet(params.seed);
  await walletCtx.wallet.waitForSyncedState();

  const walletAddressString = walletCtx.unshieldedKeystore.getBech32Address().toString();
  const callerAddressBytes = getCallerAddressBytes(walletAddressString);
  const compiledContract = getCompiledContract(callerAddressBytes);
  const providers = await createProviders(walletCtx);

  const contract = await findDeployedContract(providers, {
    contractAddress: params.contractAddress,
    compiledContract,
  });

  const toEither = parseRecipient(params.to);

  console.log(`Transferring ${params.amount} to ${params.to}...`);
  const tx = await (contract as any).callTx.transfer(toEither, params.amount);
  console.log('✅ Transfer submitted!');
  console.log(`Transaction: ${tx.public.txId}`);

  await walletCtx.wallet.stop();
}

export async function balanceOfFungible(params: {
  seed: string;
  contractAddress: string;
  account: string;
}) {
  const walletCtx = await createWallet(params.seed);
  await walletCtx.wallet.waitForSyncedState();

  const walletAddressString = walletCtx.unshieldedKeystore.getBech32Address().toString();
  const callerAddressBytes = getCallerAddressBytes(walletAddressString);
  const compiledContract = getCompiledContract(callerAddressBytes);
  const providers = await createProviders(walletCtx);

  const accountEither = parseRecipient(params.account);

  const callData = await createUnprovenCallTx(providers as any, {
    compiledContract,
    circuitId: 'balanceOf' as any,
    contractAddress: params.contractAddress as any,
    args: [accountEither],
  });

  console.log(`${callData.private.result}`);
  await walletCtx.wallet.stop();
}

export async function totalSupplyFungible(params: {
  seed: string;
  contractAddress: string;
}) {
  const walletCtx = await createWallet(params.seed);
  await walletCtx.wallet.waitForSyncedState();

  const walletAddressString = walletCtx.unshieldedKeystore.getBech32Address().toString();
  const callerAddressBytes = getCallerAddressBytes(walletAddressString);
  const compiledContract = getCompiledContract(callerAddressBytes);
  const providers = await createProviders(walletCtx);

  const callData = await createUnprovenCallTx(providers as any, {
    compiledContract,
    circuitId: 'totalSupply' as any,
    contractAddress: params.contractAddress as any,
    args: [],
  });

  console.log(`${callData.private.result}`);
  await walletCtx.wallet.stop();
}
