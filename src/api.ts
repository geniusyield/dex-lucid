// TODO: Module documentation.
import { Address, Blockfrost, Credential, Data, Lucid, OutRef, Tx, UTxO, Unit, UnixTime, fromUnit } from "@anastasia-labs/lucid-cardano-fork";
import { poConfigAddr, poMintPolicyId, poMintUTxO, poRefNft, poValCred } from "./constants";
import { PONftPolicyRedeemer, PartialOrderConfigDatum, PartialOrderDatum, RationalD } from "./contract.types";
import { assetClassDFromUnit, expectedTokenName, fromAddress } from "./utils";


// TODO: To do error handling?



// TODO: Add doc.

export const fetchPartialOrderConfig = async (lucid: Lucid): Promise<[PartialOrderConfigDatum, UTxO]> => {
  const utxo = await lucid.utxoByUnit(poRefNft)
  return [(Data.from(utxo.datum as string, PartialOrderConfigDatum)), utxo]
}


export const createOrder = async (lucid: Lucid, tx: Tx, anUTxO: UTxO, owner: Address, offerAmt: bigint, offerAC: Unit, priceAC: Unit, price: RationalD, aStakeCred?: Credential, start?: UnixTime, end?: UnixTime): Promise<Tx> => {
  // TODO: Do error checks like price, offer amount is positive, etc.
  const ownerCred = lucid.utils.paymentCredentialOf(owner);
  const outAddr = lucid.utils.credentialToAddress(poValCred, aStakeCred);
  const anOutRef: OutRef = { txHash: anUTxO.txHash, outputIndex: anUTxO.outputIndex };
  const nftName = await (expectedTokenName(anOutRef));
  const nftUnit = poMintPolicyId + nftName
  const resolveTime = (someTime?: UnixTime) => {
    if (someTime) {
      return BigInt(someTime)
    } else {
      return null
    }
  }
  const [pocDatum, pocUTxO] = await fetchPartialOrderConfig(lucid)
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
      pocfLovelaces: 0n,
      pocfOfferedTokens: 0n,
      pocfAskedTokens: 0n
    },
    podContainedPayment: 0n
  }
  const txAppended =
    tx
      .collectFrom([anUTxO])
      .mintAssets({ nftUnit: 1n }, Data.to({ txHash: { hash: anOutRef.txHash }, outputIndex: BigInt(anOutRef.outputIndex) }, PONftPolicyRedeemer))
      .readFrom([pocUTxO, poMintUTxO])
      .payToContract(outAddr, { asHash: Data.to(orderDatum, PartialOrderDatum) }, { nftUnit: 1n, offerAC: offerAmt + ((offerAmt * pocDatum.pocdMakerFeeRatio.numerator) / pocDatum.pocdMakerFeeRatio.denominator), lovelace: (pocDatum.pocdMinDeposit + pocDatum.pocdMakerFeeFlat) })
  return txAppended;
}
