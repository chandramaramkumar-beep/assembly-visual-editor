export const REGISTER_NAMES = [
  "rax", "rbx", "rcx", "rdx", "rsi", "rdi", "rbp", "rsp",
  "r8", "r9", "r10", "r11", "r12", "r13", "r14", "r15",
] as const;

export type RegisterName = (typeof REGISTER_NAMES)[number];

export function isRegisterName(name: string): name is RegisterName {
  return (REGISTER_NAMES as readonly string[]).includes(name);
}

/**
 * Arbitrary simulated stack base, chosen only to look like a plausible address.
 * Never a real memory address — see the "computer-independent" constraint in
 * the root CLAUDE.md.
 */
export const INITIAL_RSP = 0x7ffee0000000n;

export const MASK64 = (1n << 64n) - 1n;
export const SIGN_BIT_64 = 1n << 63n;
export const MIN_SIGNED_64 = -(1n << 63n);
export const MAX_SIGNED_64 = (1n << 63n) - 1n;

/** Internal safety valve against runaway loops from a mistyped label — not a product-facing cap. */
export const MAX_TRACE_STEPS = 1_000_000;
