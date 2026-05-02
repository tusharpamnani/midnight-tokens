export async function mint() {
  throw new Error(
    'This project was switched to a FungibleToken Compact contract (contracts/Fungible.compact). ' +
      'The old NFT `mint(metadata)` flow is no longer supported. Update the CLI commands to call fungible `mint(to, amount)` instead.',
  );
}
