import { Lucid, Maestro, UTxO } from "@anastasia-labs/lucid-cardano-fork";
import { fetchPartialOrderConfig, decimalToHexByte, expectedTokenName, createOrder } from '../src/index'
import { test, expect } from 'vitest'

(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

const maestroMainnetKey = import.meta.env.VITE_MAESTRO_MAINNET_KEY as string;
const maestroPreprodKey = import.meta.env.VITE_MAESTRO_PREPROD_KEY as string;
const walletPreprodSeedPhrase = import.meta.env.VITE_PREPROD_SEED_PHRASE as string;

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

test('createOrder', async () => {
  console.log(walletPreprodSeedPhrase)
  lucidPreprod.selectWalletFromSeed(walletPreprodSeedPhrase)
  const walletUTxOs = await lucidPreprod.utxosAt(await lucidPreprod.wallet.address())
  console.log(walletUTxOs)
  const tx = await createOrder(lucidPreprod, lucidPreprod.newTx(), walletUTxOs[0] as UTxO, await lucidPreprod.wallet.address(), 1000000n, "", "a2376874f7e559fbf4e41830c83058d46d8eeb8cb8cf0d94ab15a16e47454e53", { numerator: 10n, denominator: 5n }, { type: "Key", hash: "7a77d120b9e86addc7388dbbb1bd2350490b7d140ab234038632334d" }, undefined, undefined)

  const completeTx = await tx.complete()
  console.log(completeTx)
  // const signedTx = await (await tx.complete()).sign().complete()
  // const txHash = await signedTx.submit()
  // console.log(txHash)
})