// import { Approval, Transaction } from "../types";
// import {Contract, Owner, Token, Transfer} from "../types";
import {TransferEvent} from "../types/contracts/Erc721";
import {Address, Collection, ContractType, Nft, Transfers} from "../types";

export async function handleTransaction(event: TransferEvent): Promise<void> {
  logger.info(`Transfer detected. From: ${event.args.from} | To: ${event.args.to} | TokenID: ${event.args.tokenId}`);

  // util
  // get Network
  // if Null then create network
  // newNetwork = network.create({ id: event.network.id, name: event.network.name })
  const network = {
    id: '1',
    name: 'ethereum'
  }

  // util
  // get Collection
  // if Null then create Collection

  // For now this will be contract address
  let collection = await Collection.get(event.address)
  let address = await Address.get(`${network.id}-${event.address}`)

  if (address == null) {
    address = Address.create({
      id: `${network.id}-${event.address}`,
      address: event.address,
      networkId: network.id
    })
  }

  if (collection == null) {
    collection = Collection.create({
      id: event.address,
      networkId: network.id,
      contract_address: event.address,
      created_block: event.blockNumber,
      created_timestamp:(await event.getBlock()).timestamp,
      minter_addressId: (await event.getTransaction()).from
    })
  }

  let nft = await Nft.get(`${collection.id}-${event.args.tokenId}`)

  if (nft == null) {
    nft = Nft.create({
      id: `${collection.id}-${event.args.tokenId}`,
      collectionId: collection.id,
      minted_block: BigInt(event.blockNumber),
      minted_timestamp: BigInt((await event.getBlock()).timestamp),
      minter_addressId: event.address,
      current_ownerId: event.args.to,
      contract_type: ContractType.ERC721,
      metadata_uri: "ha ha ha"
    })
  }

  let transferId = `${event.transactionHash}:${event.transactionIndex}`

  let transfer = await Transfers.get(transferId)

  if (transfer == null) {
    transfer = Transfers.create({
      id: transferId,
      networkId: network.id,
      block: event.blockNumber,
      timestamp: (await event.getTransaction()).timestamp,
      transaction_id: event.transactionHash,
      nftId: nft.id,
      fromId: event.args.from,
      toId: event.args.to
    })
  }



}

// subqlTest(
//     "handleTransaction",
//
//
// )
