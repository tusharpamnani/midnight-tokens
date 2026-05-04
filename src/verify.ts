import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

import { createProviders, createWallet, zkConfigPath } from './utils.js';

export async function verify(params: { 
  seed: string; 
  contractAddress: string;
  contractType?: 'token' | 'factory'; 
}) {
  const type = params.contractType ?? 'token';
  const walletCtx = await createWallet(params.seed);
  await walletCtx.wallet.waitForSyncedState();

  const providers = await createProviders(walletCtx);

  // FIXED: The path now matches the double 'contract' nesting shown in your screenshot
  // If 'token': managed/contract/contract/index.js
  // If 'factory': managed/factory/contract/index.js
  const dir = type === 'token' ? 'contract/contract' : 'factory/contract';
  const modulePath = pathToFileURL(path.join(zkConfigPath, dir, 'index.js')).href;
  
  const contractModule = await import(modulePath);

  const state = await providers.publicDataProvider.queryContractState(params.contractAddress);
  if (!state?.data) {
    throw new Error(`No on-chain state found for contract ${params.contractAddress}`);
  }

  let ledgerState: any;
  try {
    // This uses the ledger schema from your compiled artifacts to parse the state
    ledgerState = contractModule.ledger(state.data);
  } catch (e: any) {
    throw new Error(
      `Failed to parse on-chain ledger for ${params.contractAddress}. ` +
        `This usually means the address was deployed with a different Compact schema. ` +
        `Root error: ${String(e?.message || e)}`,
    );
  }

  console.log(`✅ Contract verified (${type} schema matches compiled artifacts).`);
  
  // Safe logging
  if (ledgerState) {
    if (typeof ledgerState._tokenCount !== 'undefined') {
        console.log(`tokenCount=${ledgerState._tokenCount.toString?.() ?? String(ledgerState._tokenCount)}`);
    }
    if (typeof ledgerState._owner !== 'undefined') {
        console.log(`owner updated`);
    }
  }

  await walletCtx.wallet.stop();
}