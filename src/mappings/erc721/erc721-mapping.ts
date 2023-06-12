import { Collection, Nft, Transfer } from '../../types';
import { Erc721__factory } from '../../types/contracts';
import { TransferLog } from '../../types/abi-interfaces/Erc721';
import {
  getCollectionId,
  getNftId,
  getTransferId,
  hashId,
  incrementBigInt,
} from '../../utils/common';
import { handleAddress, handleMetadata } from '../../utils/utilHandlers';
import assert from 'assert';

export async function handleERC721(event: TransferLog): Promise<void> {
  const instance = Erc721__factory.connect(event.address, api);

  // If collection is already in db, no need to check state.
  const collectionId = getCollectionId(chainId, event.address);
  const collection = await Collection.get(collectionId);

  assert(collection, `Missing collection: ${collectionId}`);
  assert(event.args, 'No event args on erc721');

  const nftId = getNftId(collection.id, event.args.tokenId.toString());
  let nft = await Nft.get(nftId);

  if (!nft) {
    let metadataUri;
    let metadataId;
    try {
      // metadata possibly undefined
      // nft can share same metadata
      // if collection.name and symbol exist, meaning there is metadata on this contract
      metadataUri =
        collection.name || collection.symbol
          ? await instance.tokenURI(event.args.tokenId)
          : undefined;
    } catch (e) {}

    if (metadataUri) {
      metadataId = hashId(metadataUri);
      await handleMetadata(metadataId, metadataUri);
    }

    nft = Nft.create({
      id: nftId,
      tokenId: event.args.tokenId.toString(),
      amount: BigInt(1),
      collectionId: collection.id,
      minted_block: BigInt(event.blockNumber),
      minted_timestamp: event.block.timestamp,
      minter_address: event.transaction.from.toLowerCase(),
      current_owner: event.args.to.toLowerCase(),
      metadataId,
    });

    try {
      collection.total_supply = (await instance.totalSupply()).toBigInt();
    } catch (e) {
      collection.total_supply = incrementBigInt(collection.total_supply);
    }

    await Promise.all([collection.save(), nft.save()]);
  } else {
    // If NFT exist, should update the current_owner
    nft.current_owner = event.args.to.toLowerCase();
    await nft.save();
  }

  const transferId = getTransferId(
    chainId,
    event.transactionHash,
    event.logIndex.toString(),
    0
  );

  const transfer = Transfer.create({
    id: transferId,
    tokenId: event.args.tokenId.toString(),
    amount: BigInt(1),
    networkId: chainId,
    block: BigInt(event.blockNumber),
    timestamp: event.block.timestamp,
    transaction_hash: event.transactionHash,
    nftId: nft.id,
    from: event.args.from.toLowerCase(),
    to: event.args.to.toLowerCase(),
  });

  await Promise.all([
    transfer.save(),
    handleAddress(event.args.to, event.transaction.from),
    handleAddress(event.args.from, event.transaction.from),
  ]);
}
