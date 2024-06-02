// TODO: Module documentation.
import { Address, Assets, Blockfrost, Credential, Data, Lucid, OutRef, Tx, UTxO, Unit, UnixTime, fromUnit } from "@anastasia-labs/lucid-cardano-fork";
import { PONftPolicyRedeemer, PartialOrderConfigDatum, PartialOrderDatum, RationalD } from "./contract.types";
import { assetClassDFromUnit, expectedTokenName, fromAddress, mappendAssets, resolveOfferAC, resolvePOConstants } from "./utils";


// TODO: To do error handling?



// TODO: Add doc.

export const fetchPartialOrderConfig = async (lucid: Lucid): Promise<[PartialOrderConfigDatum, UTxO]> => {
  const poConstants = resolvePOConstants(lucid)
  const utxo = await lucid.utxoByUnit(poConstants.refNft)
  return [(Data.from(utxo.datum as string, PartialOrderConfigDatum)), utxo]
}


/**
 * Creates an order for a given Lucid instance.
 *
 * @param lucid - The Lucid instance.
 * @param tx - The transaction object upon which additional constraints are added.
 * @param anUTxO - An UTxO belonging to user's wallet, required to mint the special order tracking NFT, see [this](https://github.com/geniusyield/dex-contracts-api/tree/main/geniusyield-onchain/src/GeniusYield/OnChain/DEX#special-nft-for-partially-fillable-orders).
 * @param owner - The address of the owner.
 * @param offerAmt - The amount of the offer.
 * @param offerAC - The asset class of the offer.
 * @param priceAC - The asset class of the price.
 * @param price - The price as a RationalD object.
 * @param inlineDat - A boolean indicating whether the datum should be inlined or represented as hash.
 * @param aStakeCred - Optional. The stake credential used to place orders at a mangled address, with payment part of validator but staking part as specified by given credential.
 * @param start - Optional. The earliest start time after which order can be filled.
 * @param end - Optional. The end time after which order can no longer be filled.
 * @returns A Promise that resolves to a Tx object.
 * @throws Throws an error if the offer amount is not positive, if the price numerator or denominator is not positive,
 * if the offered and asked assets are the same, or if the end time is earlier than the start time.
 */
export const createOrder = async (lucid: Lucid, tx: Tx, anUTxO: UTxO, owner: Address, offerAmt: bigint, offerAC: Unit, priceAC: Unit, price: RationalD, inlineDat: boolean, aStakeCred?: Credential, start?: UnixTime, end?: UnixTime): Promise<Tx> => {
  if (offerAmt <= 0n) {
    throw new Error("Offer amount must be positive.")
  }
  if (price.numerator <= 0n || price.denominator <= 0n) {
    throw new Error("Both numerator and denominator of given price is expected to be positive.")
  }
  if (offerAC === priceAC) {
    throw new Error("Offered and asked assets must be different.")
  }
  if (start && end && end < start) {
    throw new Error("End time cannot be earlier than start time.");
  }
  const poConstants = resolvePOConstants(lucid)
  const ownerCred = lucid.utils.paymentCredentialOf(owner);
  const outAddr = lucid.utils.credentialToAddress(poConstants.valCred, aStakeCred);
  const anOutRef: OutRef = { txHash: anUTxO.txHash, outputIndex: anUTxO.outputIndex };
  const nftName = await (expectedTokenName(anOutRef));
  const nftUnit = poConstants.mintPolicyId + nftName
  const resolveTime = (someTime?: UnixTime) => {
    if (someTime) {
      return BigInt(someTime)
    } else {
      return null
    }
  }
  const [pocDatum, pocUTxO] = await fetchPartialOrderConfig(lucid)
  const makerPercentageFees = (offerAmt * pocDatum.pocdMakerFeeRatio.numerator) / pocDatum.pocdMakerFeeRatio.denominator
  const orderDatum: PartialOrderDatum = {
    podOwnerKey: ownerCred.hash,
    podOwnerAddr: fromAddress(owner),
    podOfferedAsset: assetClassDFromUnit(offerAC),
    podOfferedOriginalAmount: offerAmt,
    podOfferedAmount: offerAmt,
    podAskedAsset: assetClassDFromUnit(priceAC),
    podPrice: price,
    podNFT: nftName,
    podStart: resolveTime(start),
    podEnd: resolveTime(end),
    podPartialFills: 0n,
    podMakerLovelaceFlatFee: pocDatum.pocdMakerFeeFlat,
    podTakerLovelaceFlatFee: pocDatum.pocdTakerFee,
    podContainedFee: {
      pocfLovelaces: pocDatum.pocdMakerFeeFlat,
      pocfOfferedTokens: makerPercentageFees,
      pocfAskedTokens: 0n
    },
    podContainedPayment: 0n
  }
  const placeOrderAssets: Assets = mappendAssets(mappendAssets({ [nftUnit]: 1n }, resolveOfferAC(offerAC, offerAmt + makerPercentageFees)), { lovelace: (pocDatum.pocdMinDeposit + pocDatum.pocdMakerFeeFlat) })
  const datumField = inlineDat ? "inline" : "asHash"
  const txAppended =
    tx
      .collectFrom([anUTxO])
      .mintAssets({ [nftUnit]: 1n }, Data.to({ txHash: { hash: anOutRef.txHash }, outputIndex: BigInt(anOutRef.outputIndex) }, PONftPolicyRedeemer))
      .readFrom([pocUTxO, poConstants.mintUTxO])
      .payToContract(outAddr, { [datumField]: Data.to(orderDatum, PartialOrderDatum) }, placeOrderAssets)
  return txAppended;
}
