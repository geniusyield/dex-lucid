import { Constr, Data, Lucid, Maestro, UTxO } from "@anastasia-labs/lucid-cardano-fork";
import { fetchPartialOrderConfig, decimalToHexByte, expectedTokenName, createOrder, PartialOrderRedeemer, negateAssets, cancelOrders, fillOrders } from '../src/index'
import { test, expect } from 'vitest'

(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

const maestroMainnetKey = import.meta.env.VITE_MAESTRO_MAINNET_KEY as string;
const maestroPreprodKey = import.meta.env.VITE_MAESTRO_PREPROD_KEY as string;
const walletPreprodSeedPhrase = import.meta.env.VITE_PREPROD_SEED_PHRASE as string;
const askedTokenUnit = import.meta.env.VITE_ASKED_TOKEN_UNIT as string;

const lucidMainnet = await Lucid.new(
  new Maestro({ network: "Mainnet", apiKey: maestroMainnetKey, turboSubmit: false }),
  "Mainnet",
);
const lucidPreprod = await Lucid.new(
  new Maestro({ network: "Preprod", apiKey: maestroPreprodKey, turboSubmit: false }),
  "Preprod",
);

test('fetchPartialOrderConfig', async () => {
  const lucid = lucidMainnet
  const partialOrderConfigDatum = (await fetchPartialOrderConfig(lucid))[0]
  expect(JSON.stringify(partialOrderConfigDatum)).toBe(JSON.stringify({
    pocdSignatories: [
      'f43138a5c2f37cc8c074c90a5b347d7b2b3ebf729a44b9bbdc883787',
      '7a3c29ca42cc2d4856682a4564c776843e8b9135cf73c3ed9e986aba',
      '4fd090d48fceef9df09819f58c1d8d7cbf1b3556ca8414d3865a201c',
      'ad27a6879d211d50225f7506534bbb3c8a47e66bbe78ef800dc7b3bc'
    ],
    pocdReqSignatores: 3n,
    pocdNftSymbol: '642c1f7bf79ca48c0f97239fcb2f3b42b92f2548184ab394e1e1e503',
    pocdFeeAddr: {
      paymentCredential: { PublicKeyCredential: ["af21fa93ded7a12960b09bd1bc95d007f90513be8977ca40c97582d7"] },
      stakeCredential: null
    },
    pocdMakerFeeFlat: 1000000n,
    pocdMakerFeeRatio: { numerator: 3n, denominator: 1000n },
    pocdTakerFee: 1000000n,
    pocdMinDeposit: 2100000n
  }))
});

test('decimalToHexByte', async () => {
  expect(decimalToHexByte(12)).toBe('0c')
  expect(decimalToHexByte(255)).toBe('ff')
  expect(() => decimalToHexByte(256)).toThrowError('Number out of byte range (0-255)')
  expect(() => decimalToHexByte(-1)).toThrowError('Number out of byte range (0-255)')
  expect(decimalToHexByte(0)).toBe('00')
  expect(() => decimalToHexByte(1.1)).toThrowError('Decimal must be an integer')
})

test('expectedTokenName', async () => {
  const outRef = { txHash: 'a289a5738885a41bdaadee7683c63cd1ee3564770718f4f00bfb46187a417f01', outputIndex: 3 }
  expect(await expectedTokenName(outRef)).toBe('35238425954900b4fa8b55c6d80d51c73f1e221f6c02543e2250712f509cb002')
})

test('partialOrderRedeemer', async () => {
  const completeFillRedeemer: PartialOrderRedeemer = "CompleteFill"
  expect(Data.to(new Constr(2, []))).toBe(Data.to(completeFillRedeemer, PartialOrderRedeemer))
  const partialFillAmt = 1n
  const partialFillRedeemer: PartialOrderRedeemer = { PartialFill: [partialFillAmt] }
  expect(Data.to(new Constr(1, [partialFillAmt]))).toBe(Data.to(partialFillRedeemer, PartialOrderRedeemer))
  const cancelRedeemer: PartialOrderRedeemer = "PartialCancel"
  expect(Data.to(new Constr(0, []))).toBe(Data.to(cancelRedeemer, PartialOrderRedeemer))
})

test('negateAssets', () => {
  const assets = {
    'asset1': 100n,
    'asset2': 200n,
    'asset3': 300n,
  };

  const negatedAssets = negateAssets(assets);

  expect(negatedAssets).toEqual({
    'asset1': -100n,
    'asset2': -200n,
    'asset3': -300n,
  });
});

test('singleOrderPartialFill', async () => {
  lucidPreprod.selectWalletFromSeed(walletPreprodSeedPhrase)
  const walletUTxOs1 = await lucidPreprod.utxosAt(await lucidPreprod.wallet.address())
  const walletAddress = await lucidPreprod.wallet.address()
  const { stakeCredential } = lucidPreprod.utils.getAddressDetails(walletAddress)
  // Create first order.
  const [createOrderFees, createOrderTx1] = await createOrder(lucidPreprod, lucidPreprod.newTx(), walletUTxOs1[0] as UTxO, await lucidPreprod.wallet.address(), 10000000n, "", askedTokenUnit, { numerator: 1n, denominator: 10n }, false, stakeCredential, undefined, undefined)
  // Check that the fees are correct.
  expect(createOrderFees.flatLovelaceFees).toBe(1000000n)
  expect(createOrderFees.percentTokenFees.lovelace).toBe(30000n)
  const signedCreateOrderTx1 = await (await createOrderTx1.complete()).sign().complete()
  const create1TxHash = await signedCreateOrderTx1.submit()
  console.log("create1TxHash:", create1TxHash)
  await lucidPreprod.awaitTx(create1TxHash)
  const [fillOrdersFees, fillTx] = await fillOrders(lucidPreprod, lucidPreprod.newTx(), [[{ txHash: create1TxHash, outputIndex: 0 }, 5000000n]])
  // Check that the fees are correct.
  expect(fillOrdersFees.flatLovelaceFees).toBe(1000000n)
  expect(fillOrdersFees.percentTokenFees?.[askedTokenUnit]).toBe(1500n)
  const signedFillTx = await (await fillTx.complete()).sign().complete()
  const fillTxHash = await signedFillTx.submit()
  console.log("fillTxHash:", fillTxHash)
  await lucidPreprod.awaitTx(fillTxHash)
})

test('multiOrderFillAndCancellation', async () => {
  lucidPreprod.selectWalletFromSeed(walletPreprodSeedPhrase)
  const walletUTxOs1 = await lucidPreprod.utxosAt(await lucidPreprod.wallet.address())
  const walletAddress = await lucidPreprod.wallet.address()
  const { stakeCredential } = lucidPreprod.utils.getAddressDetails(walletAddress)
  const currentTime = Date.now()
  console.log("Current time: ", currentTime)
  const oneMinutePosix = 60 * 1000
  // Create first order.
  const [, createOrderTx1] = await createOrder(lucidPreprod, lucidPreprod.newTx(), walletUTxOs1[0] as UTxO, await lucidPreprod.wallet.address(), 10000000n, "", askedTokenUnit, { numerator: 1n, denominator: 10n }, false, stakeCredential, currentTime + oneMinutePosix, currentTime + 13 * oneMinutePosix)
  const signedCreateOrderTx1 = await (await createOrderTx1.complete()).sign().complete()
  const create1TxHash = await signedCreateOrderTx1.submit()
  console.log("create1TxHash:", create1TxHash)
  await lucidPreprod.awaitTx(create1TxHash)
  const walletUTxOs2 = await lucidPreprod.utxosAt(await lucidPreprod.wallet.address())
  // Create second order.
  const [, createOrderTx2] = await createOrder(lucidPreprod, lucidPreprod.newTx(), walletUTxOs2[0] as UTxO, await lucidPreprod.wallet.address(), 10000000n, "", askedTokenUnit, { numerator: 1n, denominator: 2n }, false, stakeCredential, currentTime, currentTime + 10 * oneMinutePosix)
  const signedCreateOrderTx2 = await (await createOrderTx2.complete()).sign().complete()
  const create2TxHash = await signedCreateOrderTx2.submit()
  console.log("create2TxHash:", create2TxHash)
  await lucidPreprod.awaitTx(create2TxHash)
  await new Promise(resolve => setTimeout(resolve, oneMinutePosix));
  const [fillOrdersFees, fillTx] = await fillOrders(lucidPreprod, lucidPreprod.newTx(), [[{ txHash: create1TxHash, outputIndex: 0 }, 5000000n], [{ txHash: create2TxHash, outputIndex: 0 }, 6000000n]])
  // Check that the fees are correct.
  expect(fillOrdersFees.flatLovelaceFees).toBe(1000000n)
  expect(fillOrdersFees.percentTokenFees?.[askedTokenUnit]).toBe(10500n)
  const signedFillTx = await (await fillTx.complete()).sign().complete()
  const fillTxHash = await signedFillTx.submit()
  console.log("fillTxHash:", fillTxHash)
  await lucidPreprod.awaitTx(fillTxHash)
  const cancelTx = await cancelOrders(lucidPreprod, lucidPreprod.newTx(), [{ txHash: fillTxHash, outputIndex: 0 }, { txHash: fillTxHash, outputIndex: 0 }])
  const signedCancelTx = await (await cancelTx.complete()).sign().complete()
  const cancelTxHash = await signedCancelTx.submit()
  console.log("cancelTxHash:", cancelTxHash)
})