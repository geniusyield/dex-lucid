import { Assets } from "@lucid-evolution/lucid";

export interface Fees {
  percentTokenFees: Assets,
  flatLovelaceFees: bigint
}