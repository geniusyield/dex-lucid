import { Address, Assets, Lucid, OutRef, Unit, fromHex, fromUnit, getAddressDetails, toHex, toUnit } from "@anastasia-labs/lucid-cardano-fork";
import { AddressD, AssetClassD, OutputReferenceD, PartialOrderContainedFee, ValueD } from "./contract.types";
import { PartialOrderConstants, po } from "./constants";


/**
 * Converts a decimal number to a hexadecimal byte representation.
 * Throws an error if the number is out of byte range (0-255) or not an integer.
 *
 * @param decimal - The decimal number to convert.
 * @returns The hexadecimal byte representation of the decimal number.
 * @throws {Error} If the number is out of byte range (0-255) or not an integer.
 */
export const decimalToHexByte = (decimal: number): string => {
  // Ensure the number is in the range of a byte (0-255)
  if (decimal < 0 || decimal > 255) {
    throw new Error("Number out of byte range (0-255)");
  }
  // Check if decimal is an integer
  if (!Number.isInteger(decimal)) {
    throw new Error("Decimal must be an integer");
  }
  // Convert to hexadecimal and pad with leading zero if necessary
  const hex = decimal.toString(16);
  return hex.length === 1 ? `0${hex}` : hex;
}

/**
 * Calculates the expected token name based on the given `outRef`.
 * 
 * @param outRef - The OutRef object containing the output index and transaction hash.
 * @returns A Promise that resolves to the calculated hash in hexadecimal format.
 */
export const expectedTokenName = async (outRef: OutRef): Promise<string> => {
  const stringToHash = `${decimalToHexByte(outRef.outputIndex)}${outRef.txHash}`;
  const hashBuffer = await crypto.subtle.digest('SHA-256', fromHex(stringToHash))
  const hashArray = new Uint8Array(hashBuffer);
  const hashHex = toHex(hashArray)
  return hashHex;
}

// `fromAddress` and `toAddress` have been taken from https://github.com/Anastasia-Labs/smart-handles-offchain/blob/19e1ba4f89ebd89b27a7e7a2e3b2aef9686ad955/src/core/utils/utils.ts#L98-L155.

export function fromAddress(address: Address): AddressD {
  // We do not support pointer addresses!

  const { paymentCredential, stakeCredential } = getAddressDetails(address);

  if (!paymentCredential) throw new Error("Not a valid payment address.");

  return {
    paymentCredential:
      paymentCredential?.type === "Key"
        ? {
          PublicKeyCredential: [paymentCredential.hash],
        }
        : { ScriptCredential: [paymentCredential.hash] },
    stakeCredential: stakeCredential
      ? {
        Inline: [
          stakeCredential.type === "Key"
            ? {
              PublicKeyCredential: [stakeCredential.hash],
            }
            : { ScriptCredential: [stakeCredential.hash] },
        ],
      }
      : null,
  };
}

export function toAddress(address: AddressD, lucid: Lucid): Address {
  const paymentCredential = (() => {
    if ("PublicKeyCredential" in address.paymentCredential) {
      return lucid.utils.keyHashToCredential(
        address.paymentCredential.PublicKeyCredential[0]
      );
    } else {
      return lucid.utils.scriptHashToCredential(
        address.paymentCredential.ScriptCredential[0]
      );
    }
  })();
  const stakeCredential = (() => {
    if (!address.stakeCredential) return undefined;
    if ("Inline" in address.stakeCredential) {
      if ("PublicKeyCredential" in address.stakeCredential.Inline[0]) {
        return lucid.utils.keyHashToCredential(
          address.stakeCredential.Inline[0].PublicKeyCredential[0]
        );
      } else {
        return lucid.utils.scriptHashToCredential(
          address.stakeCredential.Inline[0].ScriptCredential[0]
        );
      }
    } else {
      return undefined;
    }
  })();
  return lucid.utils.credentialToAddress(paymentCredential, stakeCredential);
}

export function fromOutRef(outRef: OutRef): OutputReferenceD {
  return {
    txHash: { hash: outRef.txHash },
    outputIndex: BigInt(outRef.outputIndex),
  };
}

export function assetClassDFromUnit(unit: Unit): AssetClassD {
  const { policyId, assetName } = fromUnit(unit)
  return {
    symbol: policyId,
    name: assetName ?? "",
  }
}

export function assetClassDToUnit(ac: AssetClassD): Unit {
  if (ac.symbol === "") return "lovelace"
  return toUnit(ac.symbol, ac.name)
}

/**
 * Resolves the PartialOrderConstants based on the provided Lucid network.
 * @param lucid - The Lucid object containing the network information.
 * @returns The PartialOrderConstants object corresponding to the Lucid network.
 * @throws {Error} If the Lucid network is unsupported.
 */
export function resolvePOConstants(lucid: Lucid): PartialOrderConstants {
  const nid = lucid.network
  if (nid === 'Mainnet') {
    return po.mainnet
  } else if (nid === 'Preprod') {
    return po.preprod
  } else {
    throw new Error(`Unsupported network: ${nid}`)
  }
}

/**
 * Resolves an offer asset class based on the unit and amount provided.
 * If the unit is an empty string, it returns an object with the amount in lovelace.
 * Otherwise, it returns an object with the unit as the key and the amount as the value.
 * @param unit The unit of the asset.
 * @param amt The amount of the asset.
 * @returns An object representing the resolved asset class.
 */
export function resolveAC(unit: Unit, amt: bigint): Assets {
  if (unit === '') {
    return { lovelace: amt }
  } else {
    return { [unit]: amt }
  }
}

/**
 * Merges two asset objects together by adding or appending the quantities of each asset.
 * @param a1 - The first asset object.
 * @param a2 - The second asset object.
 * @returns A new asset object that contains the merged assets.
 */
export function mappendAssets(a1: Assets, a2: Assets) {
  const a2Entries = Object.entries(a2);

  // initialize with clone of a1
  const result: Assets = { ...a1 };

  // add or append entries from a2
  a2Entries.forEach(([key, quantity]) => {
    if (result[key]) {
      result[key] += quantity;
    } else {
      result[key] = quantity;
    }
  });
  // filter out zero entries
  Object.entries(result).forEach(([key, value]) => {
    if (value === 0n) {
      delete result[key];
    }
  });
  return result;
}

/**
 * Negates the amounts of each asset in the given `Assets` object.
 * @param assets - The `Assets` object to negate.
 * @returns A new `Assets` object with negated amounts.
 */
export function negateAssets(assets: Assets): Assets {
  const result: Assets = {};
  for (const [unit, amount] of Object.entries(assets)) {
    result[unit] = -amount;
  }
  return result;
}

export const zeroContainedFee: PartialOrderContainedFee = {
  pocfLovelaces: 0n,
  pocfOfferedTokens: 0n,
  pocfAskedTokens: 0n,
};

export function isEqualContainedFee(fee1: PartialOrderContainedFee, fee2: PartialOrderContainedFee): boolean {
  return (fee1.pocfLovelaces === fee2.pocfLovelaces &&
    fee1.pocfOfferedTokens === fee2.pocfOfferedTokens &&
    fee1.pocfAskedTokens === fee2.pocfAskedTokens);
}

/**
 * Adds two `PartialOrderContainedFee` objects together and returns the result.
 * @param fee1 - The first `PartialOrderContainedFee` object.
 * @param fee2 - The second `PartialOrderContainedFee` object.
 * @returns A new `PartialOrderContainedFee` object representing the addition of `fee1` and `fee2`.
 */
export function addContainedFees(fee1: PartialOrderContainedFee, fee2: PartialOrderContainedFee): PartialOrderContainedFee {
  return {
    pocfLovelaces: fee1.pocfLovelaces + fee2.pocfLovelaces,
    pocfOfferedTokens: fee1.pocfOfferedTokens + fee2.pocfOfferedTokens,
    pocfAskedTokens: fee1.pocfAskedTokens + fee2.pocfAskedTokens,
  };
}

export function fromAssets(assets: Assets): ValueD {
  const value = new Map<string, Map<string, bigint>>();
  if (assets.lovelace) value.set("", new Map([["", assets.lovelace]]));

  const units = Object.keys(assets);
  const policies = Array.from(
    new Set(
      units
        .filter((unit) => unit !== "lovelace")
        .map((unit) => unit.slice(0, 56))
    )
  );
  policies.sort().forEach((policyId) => {
    const policyUnits = units.filter((unit) => unit.slice(0, 56) === policyId);
    const assetsMap = new Map<string, bigint>();
    policyUnits.sort().forEach((unit) => {
      assetsMap.set(unit.slice(56), assets[unit] ?? 0n);
    });
    value.set(policyId, assetsMap);
  });
  return value;
}

export function toAssets(value: ValueD): Assets {
  const result: Assets = { lovelace: value.get("")?.get("") || BigInt(0) };

  for (const [policyId, assets] of value) {
    if (policyId === "") continue;
    for (const [assetName, amount] of assets) {
      result[policyId + assetName] = amount;
    }
  }
  return result;
}

export function maxBigint(a: bigint, b: bigint): bigint {
  return a > b ? a : b;
}

export function minBigint(a: bigint, b: bigint): bigint {
  return a < b ? a : b;
}

export function ensure<T>(argument: T | undefined | null, message: string = 'This value was promised to be there.'): T {
  if (argument === undefined || argument === null) {
    throw new TypeError(message);
  }

  return argument;
}