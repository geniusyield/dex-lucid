// TODO: Module documentation.
import { Data } from "@anastasia-labs/lucid-cardano-fork";

// Reference: https://github.com/Anastasia-Labs/smart-handles-offchain/blob/main/src/core/contract.types.ts.
// TODO: Add safe utils (datum parse etc.).

export const OutputReferenceSchema = Data.Object({
  txHash: Data.Object({ hash: Data.Bytes({ minLength: 32, maxLength: 32 }) }),
  outputIndex: Data.Integer(),
});
export type OutputReference = Data.Static<typeof OutputReferenceSchema>;
export const OutputReference =
  OutputReferenceSchema as unknown as OutputReference;

export const CredentialSchema = Data.Enum([
  Data.Object({
    PublicKeyCredential: Data.Tuple([
      Data.Bytes({ minLength: 28, maxLength: 28 }),
    ]),
  }),
  Data.Object({
    ScriptCredential: Data.Tuple([
      Data.Bytes({ minLength: 28, maxLength: 28 }),
    ]),
  }),
]);
export type CredentialD = Data.Static<typeof CredentialSchema>;
export const CredentialD = CredentialSchema as unknown as CredentialD;

export const AddressSchema = Data.Object({
  paymentCredential: CredentialSchema,
  stakeCredential: Data.Nullable(
    Data.Enum([
      Data.Object({ Inline: Data.Tuple([CredentialSchema]) }),
      Data.Object({
        Pointer: Data.Tuple([
          Data.Object({
            slotNumber: Data.Integer(),
            transactionIndex: Data.Integer(),
            certificateIndex: Data.Integer(),
          }),
        ]),
      }),
    ])
  ),
});
export type AddressD = Data.Static<typeof AddressSchema>;
export const AddressD = AddressSchema as unknown as AddressD;

export const RationalSchema = Data.Object({
  numerator: Data.Integer(),
  denominator: Data.Integer()
});
export type RationalD = Data.Static<typeof RationalSchema>;
export const RationalD = RationalSchema as unknown as RationalD;

export const AssetClassSchema = Data.Object({
  symbol: Data.Bytes(),
  name: Data.Bytes(),
});
export type AssetClassD = Data.Static<typeof AssetClassSchema>;
export const AssetClassD = AssetClassSchema as unknown as AssetClassD;

export const ValueSchema = Data.Map(
  Data.Bytes(),
  Data.Map(Data.Bytes(), Data.Integer())
);
export type Value = Data.Static<typeof ValueSchema>;
export const Value = ValueSchema as unknown as Value;


// TODO: Add documentation (also for other types).
// TODO: Isolate type for PubKeyHash (28 bytes), etc.
export const PartialOrderConfigDatumSchema = Data.Object({
  pocdSignatories: Data.Array(Data.Bytes()),
  pocdReqSignatores: Data.Integer(),
  pocdNftSymbol: Data.Bytes(),
  pocdFeeAddr: AddressSchema,
  pocdMakerFeeFlat: Data.Integer(),
  pocdMakerFeeRatio: RationalSchema,
  pocdTakerFee: Data.Integer(),
  pocdMinDeposit: Data.Integer()
})
export type PartialOrderConfigDatum = Data.Static<typeof PartialOrderConfigDatumSchema>;
export const PartialOrderConfigDatum = PartialOrderConfigDatumSchema as unknown as PartialOrderConfigDatum;