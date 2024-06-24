import { Assets } from "@anastasia-labs/lucid-cardano-fork";

export interface Fees {
  percentTokenFees: Assets,
  flatLovelaceFees: bigint
}