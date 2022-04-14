import {
  CollectionBaseNftsResponse,
  CollectionNftsResponse,
  GetNftsParams,
  GetOwnersForTokenResponse,
  NftTokenType,
  OwnedBaseNft,
  OwnedBaseNftsResponse,
  OwnedNft,
  OwnedNftsResponse
} from '../types/types';
import { Alchemy } from './alchemy';
import { paginateEndpoint, requestHttpWithBackoff } from '../internal/dispatch';
import { BaseNft, Nft } from './nft';
import {
  RawBaseNft,
  RawCollectionBaseNft,
  RawCollectionNft,
  RawGetBaseNftsForCollectionResponse,
  RawGetBaseNftsResponse,
  RawGetNftsForCollectionResponse,
  RawGetNftsResponse,
  RawNft,
  RawOwnedBaseNft,
  RawOwnedNft
} from '../internal/raw-interfaces';
import { BigNumber } from 'ethers';

/**
 * Get the NFT metadata associated with the provided Base NFT.
 *
 * @param alchemy The Alchemy SDK instance.
 * @param baseNft The base NFT object to be used for the request.
 * @public
 */
export function getNftMetadata(
  alchemy: Alchemy,
  baseNft: BaseNft
): Promise<Nft>;

/**
 * Get the NFT metadata associated with the provided parameters.
 *
 * @param alchemy The Alchemy SDK instance.
 * @param contractAddress The contract address of the NFT.
 * @param tokenId Token id of the NFT as a hex string or integer.
 * @param tokenType Optionally specify the type of token to speed up the query.
 * @public
 */
export function getNftMetadata(
  alchemy: Alchemy,
  contractAddress: string,
  tokenId: number | string,
  tokenType?: NftTokenType
): Promise<Nft>;
export async function getNftMetadata(
  alchemy: Alchemy,
  contractAddressOrBaseNft: string | BaseNft,
  tokenId?: string | number,
  tokenType?: NftTokenType
): Promise<Nft> {
  let response;
  let contractAddress = '';
  if (typeof contractAddressOrBaseNft === 'string') {
    validateContractAddress(contractAddressOrBaseNft);
    contractAddress = contractAddressOrBaseNft;
    response = await requestHttpWithBackoff<GetNftMetadataParams, RawNft>(
      alchemy,
      'getNFTMetadata',
      {
        contractAddress: contractAddressOrBaseNft,
        tokenId: normalizeTokenIdToHex(tokenId!),
        tokenType: tokenType !== NftTokenType.UNKNOWN ? tokenType : undefined
      }
    );
  } else {
    contractAddress = contractAddressOrBaseNft.address;
    response = await requestHttpWithBackoff<GetNftMetadataParams, RawNft>(
      alchemy,
      'getNFTMetadata',
      {
        contractAddress: contractAddressOrBaseNft.address,
        tokenId: normalizeTokenIdToHex(contractAddressOrBaseNft.tokenId),
        tokenType:
          contractAddressOrBaseNft.tokenType !== NftTokenType.UNKNOWN
            ? contractAddressOrBaseNft.tokenType
            : undefined
      }
    );
  }
  return Nft.fromResponse(response, contractAddress);
}

/**
 * Fetches all NFTs for a given owner and yields them in an async iterable.
 *
 * This method returns the base NFTs that omit the associated metadata. To get
 * all NFTs with their associated metadata, use {@link getNftsPaginated}.
 *
 * This method pages through all page keys until all NFTs have been fetched.
 *
 * @param alchemy The Alchemy SDK instance.
 * @param params The parameters to use for the request. Limit to 20 addresses.
 */
export function getBaseNftsPaginated(
  alchemy: Alchemy,
  params: GetNftsParams
): AsyncIterable<OwnedBaseNft> {
  const paramsCopy = { ...params, withMetadata: false };
  return _getNftsPaginated(alchemy, paramsCopy);
}

/**
 * Fetches all NFTs for a given owner and yields them in an async iterable.
 *
 * This method returns the full NFT for the owner. To get all NFTs without their
 * associated metadata, use {@link getBaseNftsPaginated}.
 *
 * This method pages through all page keys until all NFTs have been fetched.
 *
 * @param alchemy The Alchemy SDK instance.
 * @param params The parameters to use for the request. Limit to 20 addresses.
 */
export function getNftsPaginated(
  alchemy: Alchemy,
  params: GetNftsParams
): AsyncIterable<OwnedNft> {
  const paramsCopy = { ...params, withMetadata: true };
  return _getNftsPaginated(alchemy, paramsCopy) as AsyncIterable<OwnedNft>;
}

/**
 * Fetches all NFTs for a given owner and yields them in an async iterable.
 *
 * @internal
 */
async function* _getNftsPaginated(
  alchemy: Alchemy,
  params: GetNftsParams
): AsyncIterable<OwnedBaseNft | OwnedNft> {
  for await (const response of paginateEndpoint(
    alchemy,
    'getNFTs',
    'pageKey',
    params
  )) {
    for (const ownedNft of response.ownedNfts as
      | RawOwnedNft[]
      | RawOwnedBaseNft[]) {
      yield {
        nft: nftFromGetNftResponse(ownedNft),
        balance: parseInt(ownedNft.balance)
      };
    }
  }
}

/**
 * Get all NFTs for an owner.
 *
 * This method returns the base NFTs that omit the associated metadata. To get
 * all NFTs with their associated metadata, use {@link getNfts}.
 *
 * @param alchemy The Alchemy SDK instance.
 * @param params The parameters to use for the request.
 * @public
 */
export async function getBaseNfts(
  alchemy: Alchemy,
  params: GetNftsParams
): Promise<OwnedBaseNftsResponse> {
  const paramsCopy = { ...params, withMetadata: false };
  const response = await requestHttpWithBackoff<
    GetNftsParams,
    RawGetBaseNftsResponse
  >(alchemy, 'getNFTs', paramsCopy);
  return {
    ownedNfts: response.ownedNfts.map(res => ({
      nft: nftFromGetNftResponse(res),
      balance: parseInt(res.balance)
    })),
    pageKey: response.pageKey,
    totalCount: response.totalCount
  };
}

/**
 * Get all NFTs for an owner.
 *
 * This method returns the full NFT for the owner. To get all NFTs without their
 * associated metadata, use {@link getBaseNfts}.
 *
 * @param alchemy The Alchemy SDK instance.
 * @param params The parameters to use for the request.
 * @public
 */
export async function getNfts(
  alchemy: Alchemy,
  params: GetNftsParams
): Promise<OwnedNftsResponse> {
  const paramsCopy = { ...params, withMetadata: true };
  const response = await requestHttpWithBackoff<
    GetNftsParams,
    RawGetNftsResponse
  >(alchemy, 'getNFTs', paramsCopy);
  return {
    ownedNfts: response.ownedNfts.map(res => ({
      nft: nftFromGetNftResponse(res) as Nft,
      balance: parseInt(res.balance)
    })),
    pageKey: response.pageKey,
    totalCount: response.totalCount
  };
}

/**
 * Get all base NFTs for a given contract address.
 *
 * This method returns the base NFTs that omit the associated metadata. To get
 * all NFTs with their associated metadata, use {@link getNftsForCollection}.
 *
 * @param alchemy The Alchemy SDK instance.
 * @param contractAddress The collection contract address to get all NFTs for.
 * @param pageKey Optional page key from an existing
 *   {@link CollectionBaseNftsResponse} or {@link CollectionNftsResponse} response.
 * @beta
 */
// TODO: Add pagination for this endpoint.
export async function getBaseNftsForCollection(
  alchemy: Alchemy,
  contractAddress: string,
  pageKey?: string
): Promise<CollectionBaseNftsResponse> {
  const response = await requestHttpWithBackoff<
    GetNftsForCollectionParams,
    RawGetBaseNftsForCollectionResponse
  >(alchemy, 'getNFTsForCollection', {
    contractAddress,
    startToken: pageKey,
    withMetadata: false
  });

  return {
    nfts: response.nfts.map(res =>
      nftFromGetNftCollectionResponse(res, contractAddress)
    ),
    pageKey: response.nextToken
  };
}

/**
 * Get all NFTs for a given contract address.
 *
 * This method returns the full NFTs in the contract. To get all NFTs without
 * their associated metadata, use {@link getBaseNftsForCollection}.
 *
 * @param alchemy The Alchemy SDK instance.
 * @param contractAddress The collection contract address to get all NFTs for.
 * @param pageKey Optional page key from an existing
 *   {@link CollectionBaseNftsResponse} or {@link CollectionNftsResponse} response.
 * @beta
 */
// TODO: add pagination for this endpoint.
export async function getNftsForCollection(
  alchemy: Alchemy,
  contractAddress: string,
  pageKey?: string
): Promise<CollectionNftsResponse> {
  const response = await requestHttpWithBackoff<
    GetNftsForCollectionParams,
    RawGetNftsForCollectionResponse
  >(alchemy, 'getNFTsForCollection', {
    contractAddress,
    startToken: pageKey,
    withMetadata: true
  });

  return {
    nfts: response.nfts.map(
      res => nftFromGetNftCollectionResponse(res, contractAddress) as Nft
    ),
    pageKey: response.nextToken
  };
}

/**
 * Gets all the owners for a given NFT contract address and token ID.
 *
 * @param alchemy The Alchemy SDK instance.
 * @param contractAddress The NFT contract address.
 * @param tokenId Token id of the NFT as a hex string or integer.
 * @beta
 */
export function getOwnersForToken(
  alchemy: Alchemy,
  contractAddress: string,
  tokenId: number | string
): Promise<GetOwnersForTokenResponse>;

/**
 * Gets all the owners for a given NFT.
 *
 * @param alchemy The Alchemy SDK instance.
 * @param nft The NFT object to get the owners for.
 * @beta
 */
export function getOwnersForToken(
  alchemy: Alchemy,
  nft: BaseNft
): Promise<GetOwnersForTokenResponse>;
export function getOwnersForToken(
  alchemy: Alchemy,
  contractAddressOrNft: string | BaseNft,
  tokenId?: number | string
): Promise<GetOwnersForTokenResponse> {
  if (typeof contractAddressOrNft === 'string') {
    validateContractAddress(contractAddressOrNft);
    return requestHttpWithBackoff(alchemy, 'getOwnersForToken', {
      contractAddress: contractAddressOrNft,
      tokenId: normalizeTokenIdToHex(tokenId!)
    });
  } else {
    return requestHttpWithBackoff(alchemy, 'getOwnersForToken', {
      contractAddress: contractAddressOrNft.address,
      tokenId: normalizeTokenIdToHex(contractAddressOrNft.tokenId)
    });
  }
}

/**
 * Helper method to convert a NFT response received from Alchemy backend to an
 * SDK NFT type.
 *
 * @internal
 */
function nftFromGetNftResponse(
  ownedNft: RawOwnedBaseNft | RawOwnedNft
): Nft | BaseNft {
  if (isNftWithMetadata(ownedNft)) {
    return Nft.fromResponse(ownedNft, ownedNft.contract.address);
  } else {
    return BaseNft.fromResponse(ownedNft, ownedNft.contract.address);
  }
}

/**
 * Helper method to convert a NFT response received from Alchemy backend to an
 * SDK NFT type.
 *
 * @internal
 */
function nftFromGetNftCollectionResponse(
  ownedNft: RawCollectionBaseNft | RawCollectionNft,
  contractAddress: string
): Nft | BaseNft {
  if (isNftWithMetadata(ownedNft)) {
    return Nft.fromResponse(ownedNft, contractAddress);
  } else {
    return BaseNft.fromResponse(ownedNft, contractAddress);
  }
}

/** @internal */
// TODO: more comprehensive type check
function isNftWithMetadata(response: RawBaseNft | RawNft): response is RawNft {
  return (response as RawNft).title !== undefined;
}

/**
 * Helper method that returns the token ID input as hex string.
 *
 * @param tokenId The token ID as an integer or hex string.
 * @internal
 */
export function normalizeTokenIdToHex(tokenId: string | number): string {
  return BigNumber.from(tokenId).toHexString();
}

// TODO: Port over validation from NFT API code, since backend error validation
// doesn't always get surfaced properly.
function validateContractAddress(contractAddress: string) {
  console.log('validating contract address', contractAddress);
}

interface GetNftsForCollectionParams {
  contractAddress: string;
  startToken?: string;
  withMetadata: boolean;
}

interface GetNftMetadataParams {
  contractAddress: string;
  tokenId: string;
  tokenType?: NftTokenType;
}
