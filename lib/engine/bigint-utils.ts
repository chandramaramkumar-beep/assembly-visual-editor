import { MASK64, SIGN_BIT_64 } from "./constants";

/** Wraps a bigint into the unsigned 64-bit range, matching two's-complement overflow behavior. */
export function wrap64(value: bigint): bigint {
  return value & MASK64;
}

/** Interprets an unsigned 64-bit bigint (as stored in registers) as a signed value. */
export function toSigned64(value: bigint): bigint {
  const v = wrap64(value);
  return v >= SIGN_BIT_64 ? v - (1n << 64n) : v;
}

export function isNegative64(value: bigint): boolean {
  return wrap64(value) >= SIGN_BIT_64;
}
