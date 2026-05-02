# Midnight Token Launchpad UI

Next.js UI for deploying and managing **custom fungible tokens** on Midnight using this repo’s root CLI (`dist/cli.js`).

## What This UI Does

- Deploy the **TokenFactory** registry contract
- Deploy a new **Fungible token** and register it in the factory (one click)
- List registered tokens (from the factory)
- Mint / transfer / query balance + total supply for any token address

## Prerequisites

- Localnet or Preprod infra running (node + indexer + proof-server)
- Root project built and compiled:
  - `npm run compile:all`
  - `npm run build`

The UI reads env vars from the root `.env`.

## Run

```bash
cd ui
npm install
npm run dev
```

Open `http://localhost:3000`.
