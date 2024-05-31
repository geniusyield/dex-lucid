// TODO: Module documentation.
import { Data } from "@anastasia-labs/lucid-cardano-fork";

// Reference: https://github.com/Anastasia-Labs/smart-handles-offchain/blob/main/src/core/contract.types.ts.
// TODO: Add safe utils (datum parse etc.).

export const OutputReferenceSchema = Data.Object({
  txHash: Data.Object({ hash: Data.Bytes({ minLength: 32, maxLength: 32 }) }),
  outputIndex: Data.Integer(),
});
export type OutputReferenceD = Data.Static<typeof OutputReferenceSchema>;
export const OutputReferenceD =
  OutputReferenceSchema as unknown as OutputReferenceD;

export const PONftPolicyRedeemerSchema = Data.Nullable(OutputReferenceSchema);
export type PONftPolicyRedeemer = Data.Static<typeof PONftPolicyRedeemerSchema>;
export const PONftPolicyRedeemer = PONftPolicyRedeemerSchema as unknown as PONftPolicyRedeemer;

export const PubKeyHashSchema = Data.Bytes({ minLength: 28, maxLength: 28 });
export type PubKeyHashD = Data.Static<typeof PubKeyHashSchema>;
export const PubKeyHashD = PubKeyHashSchema as unknown as PubKeyHashD;

export const CredentialSchema = Data.Enum([
  Data.Object({
    PublicKeyCredential: Data.Tuple([PubKeyHashSchema]),
  }),
  Data.Object({
    ScriptCredential: Data.Tuple([PubKeyHashSchema]),
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
export type ValueD = Data.Static<typeof ValueSchema>;
export const ValueD = ValueSchema as unknown as ValueD;


// TODO: Add documentation (also for other types).
export const PartialOrderConfigDatumSchema = Data.Object({
  pocdSignatories: Data.Array(PubKeyHashSchema),
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

export const PartialOrderContainedFeeSchema = Data.Object({
  pocfLovelaces: Data.Integer(),
  pocfOfferedTokens: Data.Integer(),
  pocfAskedTokens: Data.Integer()
})
export type PartialOrderContainedFee = Data.Static<typeof PartialOrderContainedFeeSchema>;
export const PartialOrderContainedFee = PartialOrderContainedFeeSchema as unknown as PartialOrderContainedFee;

export const PartialOrderFeeOutputSchema = Data.Object({
  pofdMentionedFees: Data.Map(Data.Bytes(), ValueSchema),
  pofdReservedValue: ValueSchema,
  pofdSpentUTxORef: Data.Nullable(OutputReferenceSchema)
})
export type PartialOrderFeeOutput = Data.Static<typeof PartialOrderFeeOutputSchema>;
export const PartialOrderFeeOutput = PartialOrderFeeOutputSchema as unknown as PartialOrderFeeOutput;

export const POSIXTimeSchema = Data.Integer();
export type POSIXTimeD = Data.Static<typeof POSIXTimeSchema>;
export const POSIXTimeD = POSIXTimeSchema as unknown as POSIXTimeD;

// TODO: Need to check posix time in general, write test case for it.
export const PartialOrderDatumSchema = Data.Object({
  podOwnerKey: PubKeyHashSchema,
  podOwnerAddr: AddressSchema,
  podOfferedAsset: AssetClassSchema,
  podOfferedOriginalAmount: Data.Integer(),
  podOfferedAmount: Data.Integer(),
  podAskedAsset: AssetClassSchema,
  podPrice: RationalSchema,
  podNFT: Data.Bytes(),
  podStart: Data.Nullable(POSIXTimeSchema),
  podEnd: Data.Nullable(POSIXTimeSchema),
  podPartialFills: Data.Integer(),
  podMakerLovelaceFlatFee: Data.Integer(),
  podTakerLovelaceFlatFee: Data.Integer(),
  podContainedFee: PartialOrderContainedFeeSchema,
  podContainedPayment: Data.Integer()
})
export type PartialOrderDatum = Data.Static<typeof PartialOrderDatumSchema>;
export const PartialOrderDatum = PartialOrderDatumSchema as unknown as PartialOrderDatum;

