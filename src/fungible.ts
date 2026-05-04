import crypto from 'node:crypto';
import { createUnprovenCallTx, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { toHex } from '@midnight-ntwrk/midnight-js-utils';
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
    throw new Error(`Expected 32-byte hex string (64 hex chars), got: ${hex.length} chars`);
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

  if (isHex32Bytes(trimmed)) {
    const bytes = hexToBytes32(trimmed);
    return { is_left: true, left: { bytes }, right: { bytes: new Uint8Array(32) } };
  }

  throw new Error(
    'Invalid recipient format. Use one of:\n' +
      '  coin:<64-hex>      (Zswap coin public key)\n' +
      '  contract:<64-hex>  (contract address)\n' +
      '  <64-hex>           (defaults to coin:<64-hex>)',
  );
}

function getCallerAddressBytes(bech32Address: string) {
  return crypto.createHash('sha256').update(bech32Address).digest();
}

/**
 * FIXED: This function is now async to handle the await getCompiledContract()
 */
async function getContract(seed: string, contractAddress: string) {
  const walletCtx = await createWallet(seed);
  await walletCtx.wallet.waitForSyncedState();

  const walletAddressString = walletCtx.unshieldedKeystore.getBech32Address().toString();
  void getCallerAddressBytes(walletAddressString);
  
  // FIXED: Added await and passed 'token' as the argument
  const compiledContract = await getCompiledContract('token');
  
  const providers = await createProviders(walletCtx);

  const contract = await findDeployedContract(providers, {
    contractAddress,
    compiledContract,
  });

  return { walletCtx, providers, compiledContract, contract };
}

export async function mintFungible(params: {
  seed: string;
  contractAddress: string;
  to: string;
  amount: bigint;
}) {
  const { walletCtx, contract } = await getContract(params.seed, params.contractAddress);
  const toEither = parseRecipient(params.to);

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
  const { walletCtx, contract } = await getContract(params.seed, params.contractAddress);
  const toEither = parseRecipient(params.to);

  const tx = await (contract as any).callTx.transfer(toEither, params.amount);
  console.log('✅ Transfer submitted!');
  console.log(`Transaction: ${tx.public.txId}`);
  await walletCtx.wallet.stop();
}

export async function burnFungible(params: { seed: string; contractAddress: string; amount: bigint }) {
  const { walletCtx, contract } = await getContract(params.seed, params.contractAddress);
  const tx = await (contract as any).callTx.burn(params.amount);
  console.log('✅ Burn submitted!');
  console.log(`Transaction: ${tx.public.txId}`);
  await walletCtx.wallet.stop();
}

export async function finishMintingFungible(params: { seed: string; contractAddress: string }) {
  const { walletCtx, contract } = await getContract(params.seed, params.contractAddress);
  const tx = await (contract as any).callTx.finishMinting();
  console.log('✅ Minting finished!');
  console.log(`Transaction: ${tx.public.txId}`);
  await walletCtx.wallet.stop();
}

export async function transferOwnershipFungible(params: {
  seed: string;
  contractAddress: string;
  newOwnerCoinPublicKey: string;
}) {
  const { walletCtx, contract } = await getContract(params.seed, params.contractAddress);
  const bytes = hexToBytes32(params.newOwnerCoinPublicKey.trim().replace(/^0x/i, ''));
  const tx = await (contract as any).callTx.transferOwnership({ bytes });
  console.log('✅ Ownership transfer submitted!');
  console.log(`Transaction: ${tx.public.txId}`);
  await walletCtx.wallet.stop();
}

async function query(seed: string, contractAddress: string, circuitId: string, args: any[]) {
  const { walletCtx, providers, compiledContract } = await getContract(seed, contractAddress);

  const callData = await createUnprovenCallTx(providers as any, {
    compiledContract,
    circuitId: circuitId as any,
    contractAddress: contractAddress as any,
    args,
  });

  await walletCtx.wallet.stop();
  return callData.private.result as any;
}

export async function totalSupplyFungible(params: { seed: string; contractAddress: string }) {
  const v = await query(params.seed, params.contractAddress, 'totalSupply', []);
  console.log(`${v}`);
}

export async function balanceOfFungible(params: { seed: string; contractAddress: string; account: string }) {
  const accountEither = parseRecipient(params.account);
  const v = await query(params.seed, params.contractAddress, 'balanceOf', [accountEither]);
  console.log(`${v}`);
}

export async function ownerFungible(params: { seed: string; contractAddress: string }) {
  const v = (await query(params.seed, params.contractAddress, 'owner', [])) as { bytes: Uint8Array };
  console.log(toHex(v.bytes));
}

export async function maxSupplyFungible(params: { seed: string; contractAddress: string }) {
  const v = await query(params.seed, params.contractAddress, 'maxSupply', []);
  console.log(`${v}`);
}

export async function mintingFinishedFungible(params: { seed: string; contractAddress: string }) {
  const v = await query(params.seed, params.contractAddress, 'mintingFinished', []);
  console.log(Boolean(v));
}