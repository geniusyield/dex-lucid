// TODO: Module documentation.
import { Address, Blockfrost, Data, Lucid, OutRef, Tx, Unit } from "@anastasia-labs/lucid-cardano-fork";
import { poConfigAddr, porRefNft } from "./constants";
import { PartialOrderConfigDatum } from "./contract.types";


// TODO: To do error handling?



// TODO: Add doc.

export const fetchPartialOrderConfig = async (lucid: Lucid): Promise<PartialOrderConfigDatum> => {
  const utxo = await lucid.utxoByUnit(porRefNft)
  return (Data.from(utxo.datum as string, PartialOrderConfigDatum))
}