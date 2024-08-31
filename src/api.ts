// TODO: Module documentation.
import { Address, Assets, Credential, Data, LucidEvolution, OutRef, TxBuilder, UTxO, Unit, UnixTime, credentialToAddress, fromUnit, paymentCredentialOf } from "@lucid-evolution/lucid";
import { AssetClassD, PONftPolicyRedeemer, PartialOrderConfigDatum, PartialOrderContainedFee, PartialOrderDatum, PartialOrderFeeOutput, PartialOrderRedeemer, RationalD, OutputReferenceD, ValueD } from "./contract.types";
import { addContainedFees, assetClassDFromUnit, assetClassDToUnit, ensure, expectedTokenName, fromAddress, fromAssets, isEqualContainedFee, mappendAssets, maxBigint, minBigint, negateAssets, resolveAC, resolvePOConstants, toAddress, zeroContainedFee } from "./utils";
import { PartialOrderConstants } from "./constants";
import { Fees } from "./types"

export const fetchPartialOrderConfig = async (lucid: LucidEvolution): Promise<[PartialOrderConfigDatum, UTxO]> => {
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
 * @returns A Promise that resolves to a TxBuilder object.
 * @throws Throws an error if the offer amount is not positive, if the price numerator or denominator is not positive,
 * if the offered and asked assets are the same, or if the end time is earlier than the start time.
 */
export const createOrder = async (lucid: LucidEvolution, tx: TxBuilder, anUTxO: UTxO, owner: Address, offerAmt: bigint, offerAC: Unit, priceAC: Unit, price: RationalD, inlineDat: boolean, aStakeCred?: Credential, start?: UnixTime, end?: UnixTime): Promise<[Fees, TxBuilder]> => {
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
  const ownerCred = paymentCredentialOf(owner);
  const outAddr = credentialToAddress(lucid.config().network, poConstants.valCred, aStakeCred);
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
  const placeOrderAssets: Assets = mappendAssets(mappendAssets({ [nftUnit]: 1n }, resolveAC(offerAC, offerAmt + makerPercentageFees)), { lovelace: (pocDatum.pocdMinDeposit + pocDatum.pocdMakerFeeFlat) })
  const datumField = inlineDat ? "inline" : "asHash"
  const txAppended =
    tx
      .collectFrom([anUTxO])
      .mintAssets({ [nftUnit]: 1n }, Data.to({ txHash: { hash: anOutRef.txHash }, outputIndex: BigInt(anOutRef.outputIndex) }, PONftPolicyRedeemer))
      .readFrom([pocUTxO, poConstants.mintUTxO])
      .pay.ToContract(outAddr, { kind: datumField, value: Data.to(orderDatum, PartialOrderDatum) }, placeOrderAssets)
  const orderCreationFees: Fees = { percentTokenFees: resolveAC(offerAC, makerPercentageFees), flatLovelaceFees: pocDatum.pocdMakerFeeFlat }
  return [orderCreationFees, txAppended];
}

// There is likely a bug in Lucid's `datumOf` function, so we need to use this function instead.
export async function myDatumOf(lucid: LucidEvolution, utxo: UTxO): Promise<PartialOrderDatum> {
  let datToResolve = utxo.datum
  if (!datToResolve) {
    if (!utxo.datumHash) {
      throw new Error("This UTxO does not have a datum hash.");
    }
    datToResolve = await lucid.config().provider.getDatum(utxo.datumHash);
  }
  return Data.from(datToResolve, PartialOrderDatum);
}

const fetchUTxOsDatums = async (lucid: LucidEvolution, utxos: UTxO[]): Promise<[UTxO, PartialOrderDatum][]> => {
  const utxosWithDatums = await Promise.all(utxos.map(async (utxo): Promise<[UTxO, PartialOrderDatum]> => {
    const datum = await myDatumOf(lucid, utxo)
    return [utxo, datum]
  }
  ));
  return utxosWithDatums
};

const containedFeeToAssets = (orderDatum: PartialOrderDatum): Assets => {
  return (containedFeeToAssetsM(orderDatum.podContainedFee, orderDatum.podOfferedAsset, orderDatum.podAskedAsset))
};

const containedFeeToAssetsM = (containedFee: PartialOrderContainedFee, offerAC: AssetClassD, priceAC: AssetClassD): Assets => {
  const assets: Assets = mappendAssets(mappendAssets({ lovelace: containedFee.pocfLovelaces }, { [assetClassDToUnit(offerAC)]: containedFee.pocfOfferedTokens }), { [assetClassDToUnit(priceAC)]: containedFee.pocfAskedTokens })
  return assets;
}

const partialOrderPrice = (orderDatum: PartialOrderDatum, amount: bigint): Assets => {
  return ({ [assetClassDToUnit(orderDatum.podAskedAsset)]: (amount * orderDatum.podPrice.numerator + orderDatum.podPrice.denominator - 1n) / orderDatum.podPrice.denominator })
}

const expectedPaymentWithDeposit = (poConstants: PartialOrderConstants, orderUTxOValue: Assets, orderDatum: PartialOrderDatum, isCompleteFill: boolean): Assets => {
  const toSubtract = mappendAssets(mappendAssets({ [poConstants.mintPolicyId + orderDatum.podNFT]: 1n }, { [assetClassDToUnit(orderDatum.podOfferedAsset)]: orderDatum.podOfferedAmount }), containedFeeToAssets(orderDatum))
  const toAdd = isCompleteFill ? partialOrderPrice(orderDatum, orderDatum.podOfferedAmount) : {}
  const toSend = mappendAssets(mappendAssets(orderUTxOValue, toAdd), negateAssets(toSubtract))
  return (toSend)
}

/**
 * Cancels the specified orders.
 *
 * @param lucid - The instance of the Lucid class.
 * @param tx - The transaction object.
 * @param orderRefs - An array of order references to cancel.
 * @returns A promise that resolves to the updated transaction object.
 */
export const cancelOrders = async (lucid: LucidEvolution, tx: TxBuilder, orderRefs: OutRef[]): Promise<TxBuilder> => {
  const orderUTxOs = await lucid.utxosByOutRef(orderRefs)
  const orderUTxOsWithDatums = await fetchUTxOsDatums(lucid, orderUTxOs)
  const poConstants = resolvePOConstants(lucid)
  let txAppend = tx
  let feeAcc = {}
  let feeMapAcc: Map<OutputReferenceD, ValueD> = new Map()
  for (const [orderUTxO, orderUTxOsDatum] of orderUTxOsWithDatums) {
    const outputRef: OutputReferenceD = { txHash: { hash: orderUTxO.txHash }, outputIndex: BigInt(orderUTxO.outputIndex) }
    const oldContainedFee = orderUTxOsDatum.podContainedFee
    const makerPercentFeeToRefund = (orderUTxOsDatum.podOfferedAmount * oldContainedFee.pocfOfferedTokens) / orderUTxOsDatum.podOfferedOriginalAmount
    const reqContainedFee: PartialOrderContainedFee = { pocfLovelaces: oldContainedFee.pocfLovelaces, pocfOfferedTokens: oldContainedFee.pocfOfferedTokens - makerPercentFeeToRefund, pocfAskedTokens: oldContainedFee.pocfAskedTokens }
    const reqContainedFeeValue = containedFeeToAssetsM(reqContainedFee, orderUTxOsDatum.podOfferedAsset, orderUTxOsDatum.podAskedAsset)
    const updateFeeCond = orderUTxOsDatum.podPartialFills === 0n || isEqualContainedFee(orderUTxOsDatum.podContainedFee, zeroContainedFee)
    feeAcc = updateFeeCond ? feeAcc : mappendAssets(feeAcc, reqContainedFeeValue)
    feeMapAcc = updateFeeCond ? feeMapAcc : feeMapAcc.set(outputRef, fromAssets(reqContainedFeeValue));
    txAppend = txAppend
      .collectFrom([orderUTxO], Data.to("PartialCancel", PartialOrderRedeemer))
      .pay.ToAddressWithData(toAddress(orderUTxOsDatum.podOwnerAddr, lucid), { kind: "inline", value: Data.to(outputRef, OutputReferenceD) }, expectedPaymentWithDeposit(poConstants, orderUTxO.assets, orderUTxOsDatum, false))
      .addSignerKey(orderUTxOsDatum.podOwnerKey)
      .mintAssets({ [poConstants.mintPolicyId + orderUTxOsDatum.podNFT]: -1n }, Data.to(null, PONftPolicyRedeemer));
  }
  const [pocDatum, pocUTxO] = await fetchPartialOrderConfig(lucid)
  txAppend = Object.keys(feeAcc).length ? txAppend.pay.ToAddressWithData(toAddress(pocDatum.pocdFeeAddr, lucid), { kind: "asHash", value: Data.to({ pofdMentionedFees: feeMapAcc, pofdReservedValue: fromAssets({}), pofdSpentUTxORef: null }, PartialOrderFeeOutput) }, feeAcc) : txAppend
  txAppend = txAppend
    .readFrom([poConstants.mintUTxO, poConstants.valUTxO, pocUTxO])
  return txAppend;
}

/**
 * Fills the orders with the specified amounts and returns a new transaction.
 *
 * @param lucid - The Lucid instance.
 * @param tx - The earlier transaction.
 * @param orderRefsWithAmt - An array of order references with their corresponding fill amounts.
 * @returns A promise that resolves to the new transaction with the filled orders.
 * @throws If the order cannot be filled before the start time, after the end time, if the fill amount is zero, or if the fill amount is greater than the offered amount.
 */
export const fillOrders = async (lucid: LucidEvolution, tx: TxBuilder, orderRefsWithAmt: [OutRef, bigint][]): Promise<[Fees, TxBuilder]> => {
  const orderUTxOs = await lucid.utxosByOutRef(orderRefsWithAmt.map(([ref, _]) => ref))
  const orderUTxOsWithDatums = await fetchUTxOsDatums(lucid, orderUTxOs)
  const poConstants = resolvePOConstants(lucid)
  const [pocDatum, pocUTxO] = await fetchPartialOrderConfig(lucid)
  let txAppend = tx
  let feeAcc = {}
  let feeMapAcc: Map<OutputReferenceD, ValueD> = new Map()
  let takerPercentageFees: Assets = {}
  let maxTakerFee = 0n
  const currentTime = Date.now()
  const toInlineDatum = (utxo: UTxO): "asHash" | "inline" => utxo.datum ? "inline" : "asHash"
  let validFrom: (bigint | null) = null
  let validTo: (bigint | null) = null
  // More optimal implementation could be written but with limit of < 100 orders, this is fine.
  const orderInfos: [UTxO, PartialOrderDatum, bigint][] = orderUTxOsWithDatums.map(([orderUTxO, orderUTxOsDatum]) => {
    const fillAmount = orderRefsWithAmt.find(([ref, _]) => ref.txHash === orderUTxO.txHash && ref.outputIndex === orderUTxO.outputIndex)?.[1] || 0n;
    const price = partialOrderPrice(orderUTxOsDatum, fillAmount)
    const takerUnit = assetClassDToUnit(orderUTxOsDatum.podAskedAsset)
    const takerPayment = price[takerUnit] ?? 0n
    takerPercentageFees = mappendAssets(takerPercentageFees, { [takerUnit]: (takerPayment * pocDatum.pocdMakerFeeRatio.numerator) / pocDatum.pocdMakerFeeRatio.denominator })
    maxTakerFee = maxBigint(maxTakerFee, orderUTxOsDatum.podTakerLovelaceFlatFee)
    if (orderUTxOsDatum.podStart) {
      if (orderUTxOsDatum.podStart > currentTime) {
        throw new Error("Order cannot be filled before the start time");
      }
      validFrom = validFrom ? maxBigint((orderUTxOsDatum.podStart), validFrom) : (orderUTxOsDatum.podStart)
    }
    if (orderUTxOsDatum.podEnd) {
      if (orderUTxOsDatum.podEnd < currentTime) {
        throw new Error("Order cannot be filled after the end time");
      }
      validTo = validTo ? minBigint((orderUTxOsDatum.podEnd), validTo) : (orderUTxOsDatum.podEnd)
    }
    if (fillAmount === 0n) {
      throw new Error("Fill amount cannot be zero");
    }
    if (fillAmount > orderUTxOsDatum.podOfferedAmount) {
      throw new Error("Fill amount cannot be greater than offered amount");
    }
    return [orderUTxO, orderUTxOsDatum, fillAmount];
  });
  txAppend = validFrom ? txAppend.validFrom(Number(validFrom + 5000n)) : txAppend  // Lucid doesn't seem to take enclosing slot, needed to 5 seconds as a buffer.
  txAppend = validTo ? txAppend.validTo(Number(validTo)) : txAppend
  const buildWithFeeOutput = () => {
    for (const [orderUTxO, orderUTxOsDatum, fillAmount] of orderInfos) {
      const price = partialOrderPrice(orderUTxOsDatum, fillAmount)
      const outputRef: OutputReferenceD = { txHash: { hash: orderUTxO.txHash }, outputIndex: BigInt(orderUTxO.outputIndex) }
      if (fillAmount === orderUTxOsDatum.podOfferedAmount) {
        const orderContainedFee = containedFeeToAssets(orderUTxOsDatum)
        feeMapAcc = feeMapAcc.set(outputRef, fromAssets(orderContainedFee));
        feeAcc = mappendAssets(feeAcc, orderContainedFee)
        const expectedAssetsOut = expectedPaymentWithDeposit(poConstants, orderUTxO.assets, orderUTxOsDatum, true)
        txAppend = txAppend
          .collectFrom([orderUTxO], Data.to("CompleteFill", PartialOrderRedeemer))
          .pay.ToAddressWithData(toAddress(orderUTxOsDatum.podOwnerAddr, lucid), { kind: "inline", value: Data.to(outputRef, OutputReferenceD) }, expectedAssetsOut)
          .mintAssets({ [poConstants.mintPolicyId + orderUTxOsDatum.podNFT]: -1n }, Data.to(null, PONftPolicyRedeemer))
      } else {
        const od = { ...orderUTxOsDatum, podOfferedAmount: orderUTxOsDatum.podOfferedAmount - fillAmount, podPartialFills: orderUTxOsDatum.podPartialFills + 1n, podContainedPayment: orderUTxOsDatum.podContainedPayment + (price[assetClassDToUnit(orderUTxOsDatum.podAskedAsset)] ?? 0n) }
        const expectedValueOut = mappendAssets(mappendAssets(orderUTxO.assets, price), negateAssets({ [assetClassDToUnit(orderUTxOsDatum.podOfferedAsset)]: fillAmount }))
        txAppend = txAppend
          .collectFrom([orderUTxO], Data.to({ PartialFill: [fillAmount] }, PartialOrderRedeemer))
          .pay.ToContract(orderUTxO.address, { kind: toInlineDatum(orderUTxO), value: Data.to(od, PartialOrderDatum) }, expectedValueOut)
      }
    }
    feeAcc = mappendAssets(mappendAssets(feeAcc, { lovelace: maxTakerFee }), takerPercentageFees)
    txAppend = Object.keys(feeAcc).length ? txAppend.pay.ToAddressWithData(toAddress(pocDatum.pocdFeeAddr, lucid), { kind: "asHash", value: Data.to({ pofdMentionedFees: feeMapAcc, pofdReservedValue: fromAssets({}), pofdSpentUTxORef: null }, PartialOrderFeeOutput) }, feeAcc) : txAppend
  }

  const buildWithoutFeeOutput = ([orderUTxO, orderUTxOsDatum, fillAmount]: [UTxO, PartialOrderDatum, bigint]) => {
    const price = partialOrderPrice(orderUTxOsDatum, fillAmount)
    const tf: PartialOrderContainedFee = { pocfLovelaces: maxTakerFee, pocfAskedTokens: takerPercentageFees[assetClassDToUnit(orderUTxOsDatum.podAskedAsset)] ?? 0n, pocfOfferedTokens: 0n }
    const od = { ...orderUTxOsDatum, podOfferedAmount: orderUTxOsDatum.podOfferedAmount - fillAmount, podPartialFills: orderUTxOsDatum.podPartialFills + 1n, podContainedFee: addContainedFees(orderUTxOsDatum.podContainedFee, tf), podContainedPayment: orderUTxOsDatum.podContainedPayment + (price[assetClassDToUnit(orderUTxOsDatum.podAskedAsset)] ?? 0n) }
    const expectedValueOut = mappendAssets(mappendAssets(mappendAssets(orderUTxO.assets, price), containedFeeToAssetsM(tf, orderUTxOsDatum.podOfferedAsset, orderUTxOsDatum.podAskedAsset)), negateAssets({ [assetClassDToUnit(orderUTxOsDatum.podOfferedAsset)]: fillAmount }))
    txAppend = txAppend
      .collectFrom([orderUTxO], Data.to({ PartialFill: [fillAmount] }, PartialOrderRedeemer))
      .pay.ToContract(orderUTxO.address, { kind: toInlineDatum(orderUTxO), value: Data.to(od, PartialOrderDatum) }, expectedValueOut)
  }
  if (orderInfos.some(([_, orderUTxOsDatum, fillAmount]) => fillAmount === orderUTxOsDatum.podOfferedAmount)) {
    buildWithFeeOutput();
  } else {
    if (orderInfos.length !== 1) {
      buildWithFeeOutput()
    } else {
      buildWithoutFeeOutput(ensure(orderInfos[0]));
    }
  }
  txAppend = txAppend.readFrom([poConstants.mintUTxO, poConstants.valUTxO, pocUTxO])
  const fees: Fees = { percentTokenFees: takerPercentageFees, flatLovelaceFees: maxTakerFee }
  return [fees, txAppend]
}