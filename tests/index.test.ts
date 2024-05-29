import { Lucid, Maestro } from "@anastasia-labs/lucid-cardano-fork";
import { fetchPartialOrderConfig } from '../src/index'
import { test, expect } from 'vitest'

(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

test('fetchPartialOrderConfig', async () => {
  const lucid = await Lucid.new(
    new Maestro({ network: "Mainnet", apiKey: import.meta.env.VITE_MAESTRO_KEY as string, turboSubmit: false }),
    "Mainnet",
  );
  const partialOrderConfigDatum = await fetchPartialOrderConfig(lucid)
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