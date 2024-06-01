// TODO: Module documentation.
import { Address, Blockfrost, Credential, Data, Lucid, OutRef, Tx, UTxO, Unit, UnixTime, fromUnit } from "@anastasia-labs/lucid-cardano-fork";
import { PONftPolicyRedeemer, PartialOrderConfigDatum, PartialOrderDatum, RationalD } from "./contract.types";
import { assetClassDFromUnit, expectedTokenName, fromAddress, resolvePOConstants } from "./utils";


// TODO: To do error handling?



// TODO: Add doc.

export const fetchPartialOrderConfig = async (lucid: Lucid): Promise<[PartialOrderConfigDatum, UTxO]> => {
  const poConstants = resolvePOConstants(lucid)
  const utxo = await lucid.utxoByUnit(poConstants.refNft)
  return [(Data.from(utxo.datum as string, PartialOrderConfigDatum)), utxo]
}


export const createOrder = async (lucid: Lucid, tx: Tx, anUTxO: UTxO, owner: Address, offerAmt: bigint, offerAC: Unit, priceAC: Unit, price: RationalD, aStakeCred?: Credential, start?: UnixTime, end?: UnixTime): Promise<Tx> => {
  // TODO: Do error checks like price, offer amount is positive, etc.
  const poConstants = resolvePOConstants(lucid)
  const ownerCred = lucid.utils.paymentCredentialOf(owner);
  const outAddr = lucid.utils.credentialToAddress(poConstants.valCred, aStakeCred);
  const anOutRef: OutRef = { txHash: anUTxO.txHash, outputIndex: anUTxO.outputIndex };
  const nftName = await (expectedTokenName(anOutRef));
  const nftUnit = poConstants.mintPolicyId + nftName
  // console.log(nftUnit)
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
    podMakerLovelaceFlatFee: (pocDatum.pocdMakerFeeFlat),
    podTakerLovelaceFlatFee: (pocDatum.pocdTakerFee),
    podContainedFee: {
      pocfLovelaces: pocDatum.pocdMakerFeeFlat,
      pocfOfferedTokens: makerPercentageFees,
      pocfAskedTokens: 0n
    },
    podContainedPayment: 0n
  }
  // console.log(Data.to(orderDatum, PartialOrderDatum))
  // console.log(Data.to({ txHash: { hash: anOutRef.txHash }, outputIndex: BigInt(anOutRef.outputIndex) }, PONftPolicyRedeemer))
  const txAppended =
    tx
      .collectFrom([anUTxO])
      .mintAssets({ [nftUnit]: 1n }, Data.to({ txHash: { hash: anOutRef.txHash }, outputIndex: BigInt(anOutRef.outputIndex) }, PONftPolicyRedeemer))
      .readFrom([pocUTxO, poConstants.mintUTxO])
      .payToContract(outAddr, { asHash: Data.to(orderDatum, PartialOrderDatum) }, { [nftUnit]: 1n, [offerAC]: offerAmt + makerPercentageFees, lovelace: (pocDatum.pocdMinDeposit + pocDatum.pocdMakerFeeFlat) })
  return txAppended;
}
