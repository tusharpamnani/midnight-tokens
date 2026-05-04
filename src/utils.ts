import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { WebSocket } from 'ws';
import { Buffer } from 'buffer';
import { cwd } from 'node:process';

import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { setNetworkId, getNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import * as ledger from '@midnight-ntwrk/ledger-v8';
import { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import { DustWallet } from '@midnight-ntwrk/wallet-sdk-dust-wallet';
import { HDWallet, Roles } from '@midnight-ntwrk/wallet-sdk-hd';
import { ShieldedWallet } from '@midnight-ntwrk/wallet-sdk-shielded';
import {
  createKeystore,
  InMemoryTransactionHistoryStorage,
  PublicKey,
  UnshieldedWallet,
} from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';

import { ensureCompiledArtifacts } from './check-artifacts.js';

// Setup WebSocket for Node
globalThis.WebSocket = WebSocket as any;

export const zkConfigPath = path.resolve(cwd(), 'contracts', 'managed');
const MANAGED_CONTRACTS_DIR = zkConfigPath;

const NETWORK = (process.env.MIDNIGHT_NETWORK?.trim() || 'undeployed').toLowerCase();

const DEFAULTS =
  NETWORK === 'local'
    ? {
        networkId: 'undeployed',
        indexer: 'http://127.0.0.1:8088/api/v4/graphql',
        indexerWS: 'ws://127.0.0.1:8088/api/v4/graphql/ws',
        node: 'http://127.0.0.1:9944',
        nodeWS: 'ws://127.0.0.1:9944',
        proofServer: 'http://127.0.0.1:6300',
      }
    : {
        networkId: 'preprod',
        indexer: 'https://indexer.preprod.midnight.network/api/v3/graphql',
        indexerWS: 'wss://indexer.preprod.midnight.network/api/v3/graphql/ws',
        node: 'https://rpc.preprod.midnight.network',
        nodeWS: 'wss://rpc.preprod.midnight.network',
        proofServer: 'http://127.0.0.1:6300',
      };

const NETWORK_ID = (process.env.MIDNIGHT_NETWORK_ID?.trim() || DEFAULTS.networkId) as any;
setNetworkId(NETWORK_ID);

export const CONFIG = {
  indexer: process.env.MIDNIGHT_INDEXER_HTTP?.trim() || DEFAULTS.indexer,
  indexerWS: process.env.MIDNIGHT_INDEXER_WS?.trim() || DEFAULTS.indexerWS,
  node: process.env.MIDNIGHT_NODE_HTTP?.trim() || DEFAULTS.node,
  nodeWS: process.env.MIDNIGHT_NODE_WS?.trim() || DEFAULTS.nodeWS,
  proofServer: process.env.MIDNIGHT_PROOF_SERVER?.trim() || DEFAULTS.proofServer,
} as const;

async function getContractBundle(contractName: string) {
  ensureCompiledArtifacts();
  
  let relativePath: string;
  if (contractName === 'token') {
    relativePath = path.join('contract', 'contract', 'index.js');
  } else if (contractName === 'factory') {
    relativePath = path.join('factory', 'contract', 'index.js');
  } else {
    throw new Error(`Unknown contract: ${contractName}`);
  }
  
  const contractPath = pathToFileURL(path.join(MANAGED_CONTRACTS_DIR, relativePath)).href;
  const module = await import(contractPath);
  
  if (!module.Contract || !module.witnesses) {
    throw new Error(`Artifacts for '${contractName}' missing 'Contract' or 'witnesses' export.`);
  }
  return module;
}

export async function getCompiledContract(contractName: string = 'token') {
  const { Contract, witnesses } = await getContractBundle(contractName);
  
  // 1. Extract 'make' as any to allow 3 arguments
  const make = CompiledContract.make as any;
  
  // 2. Perform the make call, cast the result to 'any' immediately, 
  // then call pipe. This prevents the TS compiler from trying to 
  // validate the argument types inside .pipe()
  return (make(
    contractName,
    Contract,
    witnesses
  ) as any).pipe(
    CompiledContract.withCompiledFileAssets(path.join(MANAGED_CONTRACTS_DIR, contractName))
  ) as any;
}
export function deriveKeys(seed: string) {
  const hdWallet = HDWallet.fromSeed(Buffer.from(seed, 'hex'));
  if (hdWallet.type !== 'seedOk') throw new Error('Invalid seed');

  const result = hdWallet.hdWallet
    .selectAccount(0)
    .selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust])
    .deriveKeysAt(0);

  if (result.type !== 'keysDerived') throw new Error('Key derivation failed');

  hdWallet.hdWallet.clear();
  return result.keys;
}

export async function createWallet(seed: string) {
  const keys = deriveKeys(seed);
  const networkId = getNetworkId();

  const shieldedSecretKeys = ledger.ZswapSecretKeys.fromSeed(keys[Roles.Zswap]);
  const dustSecretKey = ledger.DustSecretKey.fromSeed(keys[Roles.Dust]);
  const unshieldedKeystore = createKeystore(keys[Roles.NightExternal], networkId);

  const walletConfig = {
    networkId,
    indexerClientConnection: {
      indexerHttpUrl: CONFIG.indexer,
      indexerWsUrl: CONFIG.indexerWS,
    },
    provingServerUrl: new URL(CONFIG.proofServer),
    relayURL: new URL((CONFIG.nodeWS || CONFIG.node.replace(/^http/, 'ws')) as string),
    txHistoryStorage: new InMemoryTransactionHistoryStorage(),
    costParameters: {
      additionalFeeOverhead: 300_000_000_000_000n,
      feeBlocksMargin: 5,
    },
  };

  const wallet = await WalletFacade.init({
    configuration: walletConfig,
    shielded: async (config) =>
      ShieldedWallet(config).startWithSecretKeys(shieldedSecretKeys),
    unshielded: async (config) =>
      UnshieldedWallet(config).startWithPublicKey(
        PublicKey.fromKeyStore(unshieldedKeystore),
      ),
    dust: async (config) =>
      DustWallet(config).startWithSecretKey(
        dustSecretKey,
        ledger.LedgerParameters.initialParameters().dust,
      ),
  });

  await wallet.start(shieldedSecretKeys, dustSecretKey);

  return { seed, wallet, shieldedSecretKeys, dustSecretKey, unshieldedKeystore };
}

export async function createProviders(
  walletCtx: Awaited<ReturnType<typeof createWallet>>,
  customZkPath?: string
) {
  const privateStatePassword = process.env.PRIVATE_STATE_PASSWORD?.trim();
  if (!privateStatePassword) {
    throw new Error('Missing PRIVATE_STATE_PASSWORD.');
  }

  const state = await walletCtx.wallet.waitForSyncedState();

  const walletProvider = {
    getCoinPublicKey: () => state.shielded.coinPublicKey.toHexString(),
    getEncryptionPublicKey: () => state.shielded.encryptionPublicKey.toHexString(),
    async balanceTx(tx: unknown, ttl?: Date) {
      const recipe = await walletCtx.wallet.balanceUnboundTransaction(
        tx as Parameters<typeof walletCtx.wallet.balanceUnboundTransaction>[0],
        {
          shieldedSecretKeys: walletCtx.shieldedSecretKeys,
          dustSecretKey: walletCtx.dustSecretKey,
        },
        { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) },
      );

      const signedRecipe = await walletCtx.wallet.signRecipe(recipe, (payload) =>
        walletCtx.unshieldedKeystore.signData(payload),
      );

      return walletCtx.wallet.finalizeRecipe(signedRecipe);
    },
    submitTx: (tx: ledger.FinalizedTransaction) =>
      walletCtx.wallet.submitTransaction(tx),
  };

  const finalZkPath = customZkPath || zkConfigPath;
  const zkConfigProvider = new NodeZkConfigProvider(finalZkPath);
  const accountId = walletCtx.unshieldedKeystore.getBech32Address().toString();

  return {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: 'nft-mint-state',
      accountId,
      privateStoragePasswordProvider: () => privateStatePassword,
    }),
    publicDataProvider: indexerPublicDataProvider(
      CONFIG.indexer,
      CONFIG.indexerWS,
    ),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(CONFIG.proofServer, zkConfigProvider),
    walletProvider,
    midnightProvider: walletProvider,
  };
}