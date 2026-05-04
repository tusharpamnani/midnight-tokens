import { createUnprovenCallTx, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { toHex } from '@midnight-ntwrk/midnight-js-utils';
import { createProviders, createWallet, getCompiledContract } from './utils.js';

type ContractAddress = { bytes: Uint8Array };
type ZswapCoinPublicKey = { bytes: Uint8Array };

function bytesToUtf8(bytes: Uint8Array) {
  return Buffer.from(bytes).toString('utf8').replace(/\0+$/, '');
}

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

function padBytes(spec: string, length: number) {
  const buf = Buffer.alloc(length);
  buf.write(spec);
  return Uint8Array.from(buf);
}

export async function registerTokenLaunchpad(params: {
  seed: string;
  launchpadAddress: string;
  tokenAddress: string;
  name: string;
  symbol: string;
  imageUri: string;
  description: string;
  totalSupply: bigint;
}) {
  const walletCtx = await createWallet(params.seed);
  await walletCtx.wallet.waitForSyncedState();

  const providers = await createProviders(walletCtx);
  // UPDATED: Added await and passed 'factory'
  const compiledContract = await getCompiledContract('factory');

  const contract = await findDeployedContract(providers, {
    contractAddress: params.launchpadAddress,
    compiledContract,
  });

  const token = parseContractAddressHex(params.tokenAddress);

  const tx = await (contract as any).callTx.registerToken(
    token,
    padBytes(params.name, 32),
    padBytes(params.symbol, 16),
    padBytes(params.imageUri, 64),
    padBytes(params.description, 128),
    params.totalSupply,
  );

  console.log('✅ Token registered!');
  console.log(`Transaction: ${tx.public.txId}`);

  await walletCtx.wallet.stop();
}

export async function startSaleLaunchpad(params: {
  seed: string;
  launchpadAddress: string;
  tokenAddress: string;
  price: bigint;
}) {
  const walletCtx = await createWallet(params.seed);
  await walletCtx.wallet.waitForSyncedState();

  const providers = await createProviders(walletCtx);
  // UPDATED: Added await and passed 'factory'
  const compiledContract = await getCompiledContract('factory');

  const contract = await findDeployedContract(providers, {
    contractAddress: params.launchpadAddress,
    compiledContract,
  });

  const token = parseContractAddressHex(params.tokenAddress);
  const tx = await (contract as any).callTx.startSale(token, params.price);

  console.log('✅ Sale started!');
  console.log(`Transaction: ${tx.public.txId}`);

  await walletCtx.wallet.stop();
}

export async function buyLaunchpad(params: {
  seed: string;
  launchpadAddress: string;
  tokenAddress: string;
  amount: bigint;
}) {
  const walletCtx = await createWallet(params.seed);
  await walletCtx.wallet.waitForSyncedState();

  const providers = await createProviders(walletCtx);
  // UPDATED: Added await and passed 'factory'
  const compiledContract = await getCompiledContract('factory');

  const contract = await findDeployedContract(providers, {
    contractAddress: params.launchpadAddress,
    compiledContract,
  });

  const token = parseContractAddressHex(params.tokenAddress);
  const tx = await (contract as any).callTx.buy(token, params.amount);

  console.log('✅ Buy submitted!');
  console.log(`Transaction: ${tx.public.txId}`);

  await walletCtx.wallet.stop();
}

export async function endSaleLaunchpad(params: {
  seed: string;
  launchpadAddress: string;
  tokenAddress: string;
}) {
  const walletCtx = await createWallet(params.seed);
  await walletCtx.wallet.waitForSyncedState();

  const providers = await createProviders(walletCtx);
  // UPDATED: Added await and passed 'factory'
  const compiledContract = await getCompiledContract('factory');

  const contract = await findDeployedContract(providers, {
    contractAddress: params.launchpadAddress,
    compiledContract,
  });

  const token = parseContractAddressHex(params.tokenAddress);
  const tx = await (contract as any).callTx.endSale(token);

  console.log('✅ Sale ended!');
  console.log(`Transaction: ${tx.public.txId}`);

  await walletCtx.wallet.stop();
}

export async function setMetadataLaunchpad(params: {
  seed: string;
  launchpadAddress: string;
  tokenAddress: string;
  imageUri: string;
  description: string;
}) {
  const walletCtx = await createWallet(params.seed);
  await walletCtx.wallet.waitForSyncedState();

  const providers = await createProviders(walletCtx);
  // UPDATED: Added await and passed 'factory'
  const compiledContract = await getCompiledContract('factory');

  const contract = await findDeployedContract(providers, {
    contractAddress: params.launchpadAddress,
    compiledContract,
  });

  const token = parseContractAddressHex(params.tokenAddress);
  const tx = await (contract as any).callTx.setMetadata(
    token,
    padBytes(params.imageUri, 64),
    padBytes(params.description, 128),
  );

  console.log('✅ Metadata updated!');
  console.log(`Transaction: ${tx.public.txId}`);

  await walletCtx.wallet.stop();
}

export async function deactivateLaunchpad(params: {
  seed: string;
  launchpadAddress: string;
  tokenAddress: string;
}) {
  const walletCtx = await createWallet(params.seed);
  await walletCtx.wallet.waitForSyncedState();

  const providers = await createProviders(walletCtx);
  // UPDATED: Added await and passed 'factory'
  const compiledContract = await getCompiledContract('factory');

  const contract = await findDeployedContract(providers, {
    contractAddress: params.launchpadAddress,
    compiledContract,
  });

  const token = parseContractAddressHex(params.tokenAddress);
  const tx = await (contract as any).callTx.deactivate(token);

  console.log('✅ Token deactivated!');
  console.log(`Transaction: ${tx.public.txId}`);

  await walletCtx.wallet.stop();
}

async function queryLaunchpad(params: {
  seed: string;
  launchpadAddress: string;
  circuitId: string;
  args: any[];
}) {
  const walletCtx = await createWallet(params.seed);
  await walletCtx.wallet.waitForSyncedState();

  const providers = await createProviders(walletCtx);
  // UPDATED: Added await and passed 'factory'
  const compiledContract = await getCompiledContract('factory');

  const callData = await createUnprovenCallTx(providers as any, {
    compiledContract,
    circuitId: params.circuitId as any,
    contractAddress: params.launchpadAddress as any,
    args: params.args,
  });

  await walletCtx.wallet.stop();
  return callData.private.result as any;
}

// ... (launchpadTokenCount, launchpadTokenAt, launchpadPriceOf, etc. remain the same, 
// using queryLaunchpad which is now updated above) ...

export async function launchpadTokenCount(params: { seed: string; launchpadAddress: string }) {
  const count = await queryLaunchpad({
    seed: params.seed,
    launchpadAddress: params.launchpadAddress,
    circuitId: 'tokenCount',
    args: [],
  });
  console.log(`${count}`);
}

export async function launchpadTokenAt(params: {
  seed: string;
  launchpadAddress: string;
  index: bigint;
}) {
  const token = (await queryLaunchpad({
    seed: params.seed,
    launchpadAddress: params.launchpadAddress,
    circuitId: 'tokenAt',
    args: [params.index],
  })) as ContractAddress;
  console.log(toHex(token.bytes));
}

export async function launchpadPriceOf(params: {
  seed: string;
  launchpadAddress: string;
  tokenAddress: string;
}) {
  const token = parseContractAddressHex(params.tokenAddress);
  const price = await queryLaunchpad({
    seed: params.seed,
    launchpadAddress: params.launchpadAddress,
    circuitId: 'priceOf',
    args: [token],
  });
  console.log(`${price}`);
}

export async function launchpadRaisedOf(params: {
  seed: string;
  launchpadAddress: string;
  tokenAddress: string;
}) {
  const token = parseContractAddressHex(params.tokenAddress);
  const raised = await queryLaunchpad({
    seed: params.seed,
    launchpadAddress: params.launchpadAddress,
    circuitId: 'raisedOf',
    args: [token],
  });
  console.log(`${raised}`);
}

export async function launchpadVolumeOf(params: {
  seed: string;
  launchpadAddress: string;
  tokenAddress: string;
}) {
  const token = parseContractAddressHex(params.tokenAddress);
  const volume = await queryLaunchpad({
    seed: params.seed,
    launchpadAddress: params.launchpadAddress,
    circuitId: 'volumeOf',
    args: [token],
  });
  console.log(`${volume}`);
}

export async function launchpadBuyersOf(params: {
  seed: string;
  launchpadAddress: string;
  tokenAddress: string;
}) {
  const token = parseContractAddressHex(params.tokenAddress);
  const buyers = await queryLaunchpad({
    seed: params.seed,
    launchpadAddress: params.launchpadAddress,
    circuitId: 'buyersOf',
    args: [token],
  });
  console.log(`${buyers}`);
}

export async function launchpadIsSaleActive(params: {
  seed: string;
  launchpadAddress: string;
  tokenAddress: string;
}) {
  const token = parseContractAddressHex(params.tokenAddress);
  const active = await queryLaunchpad({
    seed: params.seed,
    launchpadAddress: params.launchpadAddress,
    circuitId: 'isSaleActive',
    args: [token],
  });
  console.log(Boolean(active));
}

export async function launchpadCreatorOf(params: {
  seed: string;
  launchpadAddress: string;
  tokenAddress: string;
}) {
  const token = parseContractAddressHex(params.tokenAddress);
  const creator = (await queryLaunchpad({
    seed: params.seed,
    launchpadAddress: params.launchpadAddress,
    circuitId: 'creatorOf',
    args: [token],
  })) as ZswapCoinPublicKey;
  console.log(toHex(creator.bytes));
}

export async function launchpadTokenMeta(params: {
  seed: string;
  launchpadAddress: string;
  tokenAddress: string;
}) {
  const token = parseContractAddressHex(params.tokenAddress);

  const walletCtx = await createWallet(params.seed);
  await walletCtx.wallet.waitForSyncedState();
  const providers = await createProviders(walletCtx);
  // UPDATED: Added await and passed 'factory'
  const compiledContract = await getCompiledContract('factory');

  async function query(circuitId: string, args: any[]) {
    const callData = await createUnprovenCallTx(providers as any, {
      compiledContract,
      circuitId: circuitId as any,
      contractAddress: params.launchpadAddress as any,
      args,
    });
    return callData.private.result as any;
  }

  const name = bytesToUtf8((await query('nameOf', [token])) as Uint8Array);
  const symbol = bytesToUtf8((await query('symbolOf', [token])) as Uint8Array);
  const imageUri = bytesToUtf8((await query('imageUriOf', [token])) as Uint8Array);
  const description = bytesToUtf8((await query('descriptionOf', [token])) as Uint8Array);
  const totalSupply = await query('totalSupplyOf', [token]);
  const active = await query('isActive', [token]);
  const saleActive = await query('isSaleActive', [token]);
  const price = await query('priceOf', [token]);
  const raised = await query('raisedOf', [token]);
  const volume = await query('volumeOf', [token]);
  const buyers = await query('buyersOf', [token]);
  const creator = (await query('creatorOf', [token])) as ZswapCoinPublicKey;

  console.log(JSON.stringify({
    token: params.tokenAddress,
    name,
    symbol,
    imageUri,
    description,
    creatorCoinPublicKey: toHex(creator.bytes),
    totalSupply: `${totalSupply}`,
    active: Boolean(active),
    saleActive: Boolean(saleActive),
    price: `${price}`,
    raised: `${raised}`,
    volume: `${volume}`,
    buyers: `${buyers}`,
  }, null, 2));

  await walletCtx.wallet.stop();
}

export async function launchpadListTokens(params: { seed: string; launchpadAddress: string }) {
  const walletCtx = await createWallet(params.seed);
  await walletCtx.wallet.waitForSyncedState();
  const providers = await createProviders(walletCtx);
  // UPDATED: Added await and passed 'factory'
  const compiledContract = await getCompiledContract('factory');

  async function query(circuitId: string, args: any[]) {
    const callData = await createUnprovenCallTx(providers as any, {
      compiledContract,
      circuitId: circuitId as any,
      contractAddress: params.launchpadAddress as any,
      args,
    });
    return callData.private.result as any;
  }

  const count = Number(await query('tokenCount', []));
  const tokens: any[] = [];
  for (let i = 0; i < count; i++) {
    const token = (await query('tokenAt', [BigInt(i)])) as ContractAddress;
    const tokenHex = toHex(token.bytes).replace(/^0x/i, '');
    const name = bytesToUtf8((await query('nameOf', [{ bytes: token.bytes }])) as Uint8Array);
    const symbol = bytesToUtf8((await query('symbolOf', [{ bytes: token.bytes }])) as Uint8Array);
    const imageUri = bytesToUtf8((await query('imageUriOf', [{ bytes: token.bytes }])) as Uint8Array);
    const description = bytesToUtf8((await query('descriptionOf', [{ bytes: token.bytes }])) as Uint8Array);
    const totalSupply = await query('totalSupplyOf', [{ bytes: token.bytes }]);
    const active = await query('isActive', [{ bytes: token.bytes }]);
    const saleActive = await query('isSaleActive', [{ bytes: token.bytes }]);
    const price = await query('priceOf', [{ bytes: token.bytes }]);
    const raised = await query('raisedOf', [{ bytes: token.bytes }]);
    const volume = await query('volumeOf', [{ bytes: token.bytes }]);
    const buyers = await query('buyersOf', [{ bytes: token.bytes }]);
    const creator = (await query('creatorOf', [{ bytes: token.bytes }])) as ZswapCoinPublicKey;

    tokens.push({
      token: tokenHex,
      name,
      symbol,
      imageUri,
      description,
      creatorCoinPublicKey: toHex(creator.bytes),
      totalSupply: `${totalSupply}`,
      active: Boolean(active),
      saleActive: Boolean(saleActive),
      price: `${price}`,
      raised: `${raised}`,
      volume: `${volume}`,
      buyers: `${buyers}`,
    });
  }

  console.log(JSON.stringify(tokens, null, 2));
  await walletCtx.wallet.stop();
}