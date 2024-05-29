// TODO: Module documentation.
import { Address, OutRef, Unit } from "@anastasia-labs/lucid-cardano-fork";

/**
 * The address where the fee configuration UTxO is stored.
 */
export const poConfigAddr: Address = "addr1wxcqkdhe7qcfkqcnhlvepe7zmevdtsttv8vdfqlxrztaq2gge58rd"

/**
 * NFT used to identify fee configuration UTxO at {@link poConfigAddr}.
 */
export const porRefNft: Unit = "fae686ea8f21d567841d703dea4d4221c2af071a6f2b433ff07c0af2682fd5d4b0d834a3aa219880fa193869b946ffb80dba5532abca0910c55ad5cd"

/**
 * Output reference of swap validator script.
 */
export const porValRef: OutRef = {
  txHash: "c8adf3262d769f5692847501791c0245068ed5b6746e7699d23152e94858ada7", outputIndex: 2
}

/**
 * Output reference of swap minting policy script.
 */
export const porMintRef: OutRef = { txHash: "c8adf3262d769f5692847501791c0245068ed5b6746e7699d23152e94858ada7", outputIndex: 1 }