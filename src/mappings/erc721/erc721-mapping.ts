import {Address, AnyJson, Collection, ContractType, Network, Nft, Transfers} from "../../types";
import {Erc721__factory} from "../../types/contracts";
import {TransferLog} from "../../types/abi-interfaces/Erc721";
import {decodeMetadata, getAddressId, getCollectionId, getNftId, getTransferId} from "../../utils/common";
import {BigNumber} from "ethers";
import {enumNetwork} from "../../utils/network-enum";
import {handleNetwork} from "../../utils/utilHandlers";

export async function handleERC721(
    event: TransferLog,
    _network: enumNetwork
): Promise<void> {

  let instance = Erc721__factory.connect(event.address, api);
  let totalSupply = BigInt(0)
  let isERC721 = false

  try {
    isERC721 = await instance.supportsInterface('0x80ac58cd');

    if (!isERC721){
      return
    }
    logger.info(`isERC721 ${isERC721}`)
    logger.info(`address: ${event.address}`)

  } catch (e) {
    return;
  }

  let isERC721Metadata = false
  let isERC721Enumerable = false

  try {
    [isERC721Enumerable, isERC721Metadata] = await Promise.all([
      instance.supportsInterface('0x780e9d63'),
      instance.supportsInterface('0x5b5e139f')
    ])
  } catch {
  }

  let network = await handleNetwork(_network.chainId, _network.name)

  const addressId = getAddressId(network.id, event.address)
  let address = await Address.get(addressId)

  if (!address) {
    address = Address.create({
      id: addressId,
      address: event.address,
      networkId: network.id
    })
    await address.save()
  }

  // TODO Refactor
  const collectionId = getCollectionId(network.id, event.address)
  let collection = await Collection.get(collectionId)

  if (!collection) {
    let name: string = null
    let symbol: string = null

    if (isERC721Metadata) {
      [name, symbol] = await Promise.all([
        instance.name(),
        instance.symbol(),
      ])
    }

    if (isERC721Enumerable) {
      totalSupply = (await instance.totalSupply()).toBigInt()
      logger.info(`Enumerable, total supply ${totalSupply}`)
    }

    collection = Collection.create({
      id: collectionId,
      networkId: network.id,
      contract_address: event.address,
      created_block: BigInt(event.blockNumber),
      created_timestamp: event.block.timestamp,
      minter_addressId: event.transaction.from,
      total_supply: totalSupply,
      name,
      symbol
    })
    await collection.save()
  }

  const nftId = getNftId(collection.id, event.args.tokenId.toString())
  let nft = await Nft.get(nftId)

  if (!nft) {
    logger.info(`nft created at ${event.blockNumber}`)



    const metadataUri = isERC721Metadata ? (await instance.tokenURI(event.args.tokenId)) : null
    const metadataJson = metadataUri && await decodeMetadata(metadataUri)

    nft = Nft.create({
      id: nftId,
      tokenId: event.args.tokenId.toString(),
      amount: BigInt(1),
      collectionId: collection.id,
      minted_block: BigInt(event.blockNumber),
      minted_timestamp: event.block.timestamp,
      minter_addressId: event.address,
      current_ownerId: event.args.to,
      contract_type: ContractType.ERC721,
      metadata_uri: metadataUri,
      metadata: metadataJson,
    })



    collection.total_supply = isERC721Enumerable
        ? (await instance.totalSupply()).toBigInt()
        : BigNumber.from(collection.total_supply).add(1).toBigInt()

    await Promise.all([
        collection.save(),
        nft.save()
    ]).then(()=> {
      logger.info("updated collections")
      logger.info("saved new NFT")
    })
  }

  const transferId = getTransferId(event.transactionHash, event.transactionIndex)
  let transfer = await Transfers.get(transferId)

  if (!transfer) {
    transfer = Transfers.create({
      id: transferId,
      tokenId: event.args.tokenId.toString(),
      amount: BigInt(1),
      networkId: network.id,
      block: BigInt(event.blockNumber),
      timestamp: event.block.timestamp,
      transaction_id: event.transactionHash,
      nftId: nft.id,
      fromId: event.args.from,
      toId: event.args.to
    })
    await transfer.save()
  }
}
