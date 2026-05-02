export async function transfer() {
  throw new Error(
    'This project was switched to a FungibleToken Compact contract (contracts/Fungible.compact). ' +
      'The old NFT `transfer(tokenId, newOwner, metadataHash)` flow is no longer supported. Update the CLI commands to call fungible `transfer(to, amount)` instead.',
  );
}
