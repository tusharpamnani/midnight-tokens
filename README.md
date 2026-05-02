# Midnight Token Launchpad (Midnight / Compact)

A minimal CLI project for compiling and deploying a **Compact** smart contract to the **Midnight** network using the **Midnight.js** SDK. The current contract in this repo is a **fungible token** (`contracts/Fungible.compact`).

## What’s Included

- Compact contract source: `contracts/Fungible.compact`
- Contract compilation scripts: `npm run compile` / `npm run compile:zk`
- Proof server helper: `npm run start-proof-server` (Docker)
- CLI entrypoint: `npm run cli -- <command>`
- Local files written by the CLI:
  - `deployment.json` (deployment info)
  - `local-state.json` (local app state; used by `balance`)

## Prerequisites

- Node.js 18+
- Docker (for the proof server)
- `compact` CLI available on your PATH (used by `npm run compile`)
- Port `6300` free (proof server)

## Setup

```bash
npm install
```

Create your env file:

```bash
cp .env.example .env
```

## Compile the Contract

The CLI expects compiled artifacts under `contracts/managed/contract/...`.

```bash
npm run compile
```

If you want ZK compilation enabled (slower):

```bash
npm run compile:zk
```

## Start the Proof Server

In a separate terminal:

```bash
npm run start-proof-server
```

## Deploy

Set your wallet seed (and optionally the network id) then deploy:

```bash
export WALLET_SEED="..."                 # required for real deployments
export MIDNIGHT_NETWORK_ID="preprod"     # optional (default: preprod)

npm run deploy
```

Deployment metadata is written to `deployment.json`.

## CLI Commands

```bash
npm run cli -- deploy
npm run cli -- balance
```

Notes:
- `deploy` currently deploys a token with hardcoded parameters. Update `src/deploy.ts` to change name/symbol/decimals/initial supply.
- `balance` reads from `local-state.json` (this repo currently only implements a basic local view).

## Environment Variables

- `WALLET_SEED`: wallet seed used by the CLI (recommended: set explicitly)
- `MIDNIGHT_NETWORK_ID`: network id (defaults to `preprod`)
- `PRIVATE_STATE_PASSWORD`: password for the local private state store (defaults to `Str0ng!MidnightLocal` if unset)

## Project Structure

- `contracts/`: Compact contract source
- `contracts/managed/contract/`: generated artifacts from `compact compile`
- `src/`: Midnight.js wallet + provider setup and the CLI implementation
- `dist/`: compiled TypeScript output (`npm run build`)
