import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const contractSourcePath = path.resolve(
  __dirname,
  '..',
  'contracts',
  'Fungible.compact',
);
const generatedContractPath = path.resolve(
  __dirname,
  '..',
  'contracts',
  'managed',
  'contract',
  'contract',
  'index.js',
);

const factorySourcePath = path.resolve(
  __dirname,
  '..',
  'contracts',
  'TokenFactory.compact',
);
const generatedFactoryPath = path.resolve(
  __dirname,
  '..',
  'contracts',
  'managed',
  'factory',
  'contract',
  'index.js',
);

export function ensureCompiledArtifacts() {
  if (!fs.existsSync(contractSourcePath)) {
    throw new Error(
      'Missing contracts/Fungible.compact. Restore the contract source before compiling.',
    );
  }

  if (!fs.existsSync(generatedContractPath)) {
    throw new Error(
      'Missing compiled contract artifacts. Run `npm run compile` before `npm run build`, `npm run deploy`, or `npm run cli`.',
    );
  }
}

export function ensureFactoryArtifacts() {
  if (!fs.existsSync(factorySourcePath)) {
    throw new Error(
      'Missing contracts/TokenFactory.compact. Restore the factory contract source before compiling.',
    );
  }

  if (!fs.existsSync(generatedFactoryPath)) {
    throw new Error(
      'Missing compiled factory artifacts. Run `npm run compile:factory` before using factory commands.',
    );
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    ensureCompiledArtifacts();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
