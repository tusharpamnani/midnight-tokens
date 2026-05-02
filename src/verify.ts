export async function verify() {
  throw new Error(
    'This project was switched to a FungibleToken Compact contract (contracts/Fungible.compact). ' +
      'The old NFT `verifyOwnership(tokenId, metadataHash)` flow is no longer supported.',
  );
}
