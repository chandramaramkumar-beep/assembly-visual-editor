import { MASK64, SIGN_BIT_64 } from "./constants";
import { isNegative64, wrap64 } from "./bigint-utils";
import type { Flags } from "./types";

function zfSf(result: bigint): Pick<Flags, "zf" | "sf"> {
  const r = wrap64(result);
  return { zf: r === 0n, sf: isNegative64(r) };
}

/** Flags for `a + b`, both treated as unsigned 64-bit values already wrapped. */
export function addFlags(a: bigint, b: bigint): Flags {
  const raw = a + b;
  const result = wrap64(raw);
  const cf = raw > MASK64;
  const signA = isNegative64(a);
  const signB = isNegative64(b);
  const signR = isNegative64(result);
  const of = signA === signB && signR !== signA;
  return { ...zfSf(result), cf, of };
}

/** Flags for `a - b`. */
export function subFlags(a: bigint, b: bigint): Flags {
  const result = wrap64(a - b);
  const cf = wrap64(a) < wrap64(b);
  const signA = isNegative64(a);
  const signB = isNegative64(b);
  const signR = isNegative64(result);
  const of = signA !== signB && signR !== signA;
  return { ...zfSf(result), cf, of };
}

/** INC/DEC use add/sub-shaped overflow logic but never touch CF (real x86 behavior). */
export function incFlags(a: bigint, previousCf: boolean): Flags {
  return { ...addFlags(a, 1n), cf: previousCf };
}

export function decFlags(a: bigint, previousCf: boolean): Flags {
  return { ...subFlags(a, 1n), cf: previousCf };
}

/** AND/OR/XOR/TEST: CF and OF always cleared, SF/ZF from the result. */
export function logicFlags(result: bigint): Flags {
  return { ...zfSf(result), cf: false, of: false };
}

export function negFlags(original: bigint): Flags {
  const result = wrap64(-original);
  return {
    ...zfSf(result),
    cf: wrap64(original) !== 0n,
    of: wrap64(original) === SIGN_BIT_64,
  };
}

export function shlFlags(original: bigint, count: bigint, result: bigint): Flags {
  const n = count & 63n;
  const cf = ((original >> (64n - n)) & 1n) === 1n;
  const of = n === 1n ? (isNegative64(result) !== cf) : undefined;
  return { ...zfSf(result), cf, of: of ?? false };
}

export function shrFlags(original: bigint, count: bigint, result: bigint): Flags {
  const n = count & 63n;
  const cf = ((wrap64(original) >> (n - 1n)) & 1n) === 1n;
  const of = n === 1n ? isNegative64(original) : false;
  return { ...zfSf(result), cf, of };
}

export function imulFlags(fullProduct: bigint, truncated: bigint): Pick<Flags, "cf" | "of"> {
  const overflowed = fullProduct !== truncated;
  return { cf: overflowed, of: overflowed };
}
