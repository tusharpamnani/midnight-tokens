'use client';

// Guard against server-side execution
if (typeof window === 'undefined') {
  throw new Error('ui/lib/midnight.ts should only be loaded on the client-side');
}

import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import type {
  MidnightProvider,
  PrivateStateProvider,
  WalletProvider,
  ProofProvider,
} from '@midnight-ntwrk/midnight-js-types';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';

export type ConnectedSession = {
  api: any;
  config: any;
  providers: {
    privateStateProvider: PrivateStateProvider<string, any>;
    publicDataProvider: any;
    zkConfigProvider: any;
    proofProvider: ProofProvider;
    walletProvider: WalletProvider;
    midnightProvider: MidnightProvider;
  };
  unshieldedAddress: string;
};

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function createPrivateStateProvider() {
  let contractAddressScope = '';
  const stateStore = new Map<string, any>();

  const scopedStateKey = (privateStateId: string) => `${contractAddressScope}:${privateStateId}`;

  return {
    setContractAddress(address: string) {
      contractAddressScope = address;
    },
    async set(privateStateId: string, state: any) {
      stateStore.set(scopedStateKey(privateStateId), state);
    },
    async get(privateStateId: string) {
      return stateStore.get(scopedStateKey(privateStateId)) ?? null;
    },
    async remove(privateStateId: string) {
      stateStore.delete(scopedStateKey(privateStateId));
    },
    async clear() {
      stateStore.clear();
    },
    async setSigningKey(address: string, signingKey: any) {
      stateStore.set(`signingKey:${address}`, signingKey);
    },
    async getSigningKey(address: string) {
      return stateStore.get(`signingKey:${address}`) ?? null;
    },
    async removeSigningKey(address: string) {
      stateStore.delete(`signingKey:${address}`);
    },
    async clearSigningKeys() {
      Array.from(stateStore.keys())
        .filter((key) => key.startsWith('signingKey:'))
        .forEach((key) => stateStore.delete(key));
    },
    async exportPrivateStates(): Promise<never> {
      throw new Error('Private state export is not implemented.');
    },
    async importPrivateStates(): Promise<never> {
      throw new Error('Private state import is not implemented.');
    },
    async exportSigningKeys(): Promise<never> {
      throw new Error('Signing key export is not implemented.');
    },
    async importSigningKeys(): Promise<never> {
      throw new Error('Signing key import is not implemented.');
    },
  } as PrivateStateProvider<string, any>;
}

export async function createConnectedSession(api: any): Promise<ConnectedSession> {
  const [config, unshieldedAddress, shieldedAddress] = await Promise.all([
    api.getConfiguration(),
    api.getUnshieldedAddress(),
    api.getShieldedAddresses(),
  ]);

  setNetworkId(config.networkId);

  // Token UI currently uses server-side CLI for contract actions. We still build a minimal
  // client-side session so the UI can detect/connect the browser wallet and display addresses.
  const zkConfigProvider = null;
  const proofProvider: ProofProvider = {
    async proveTx() {
      throw new Error(
        'Proof generation is not configured in this UI build. Add contract artifacts under public/contract/collection (keys + zkir) before submitting ZK transactions from the browser wallet.',
      );
    },
  } as any;

  const privateStateProvider = createPrivateStateProvider();

  const walletProvider: WalletProvider = {
    balanceTx: async (tx: any) => {
      const txHex = toHex(tx.serialize());
      const balanced = await api.balanceUnsealedTransaction(txHex);
      if (!balanced?.tx) {
        throw new Error(`balanceUnsealedTransaction returned invalid result: ${JSON.stringify(balanced)}`);
      }

      const { Transaction } = await import('@midnight-ntwrk/ledger-v8');
      const bytes = new Uint8Array(balanced.tx.match(/.{2}/g).map((b: string) => Number.parseInt(b, 16)));
      return Transaction.deserialize('signature', 'proof', 'binding', bytes);
    },
    getCoinPublicKey: () => shieldedAddress.shieldedCoinPublicKey,
    getEncryptionPublicKey: () => shieldedAddress.shieldedEncryptionPublicKey,
  } as any;

  const midnightProvider: MidnightProvider = {
    submitTx: async (tx: any) => {
      const txHex = toHex(tx.serialize());
      const result = await api.submitTransaction(txHex);
      const txIdFromObject = tx?.id ? toHex(tx.id) : tx?.hash ? toHex(tx.hash) : '';
      return (typeof result === 'string' ? result : result?.transactionId || result?.id || txIdFromObject) || '';
    },
  } as any;

  const indexerQueryURL =
    process.env.NEXT_PUBLIC_INDEXER_URI || 'https://indexer.preprod.midnight.network/api/v4/graphql';
  const indexerSubURL =
    process.env.NEXT_PUBLIC_INDEXER_WS_URI || 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws';
  const WS = typeof window !== 'undefined' ? window.WebSocket : undefined;
  const publicDataProvider = indexerPublicDataProvider(indexerQueryURL, indexerSubURL, WS as any);

  return {
    api,
    config,
    providers: {
      privateStateProvider,
      publicDataProvider,
      zkConfigProvider,
      proofProvider,
      walletProvider,
      midnightProvider,
    },
    unshieldedAddress: unshieldedAddress.unshieldedAddress,
  };
}
