import type { RegisterName } from "./constants";

export type Operand =
  | { readonly kind: "register"; readonly name: RegisterName }
  | { readonly kind: "immediate"; readonly value: bigint };

/** `[base]`, `[base+disp]`, or `[base-disp]` — address arithmetic only, never a memory read. */
export interface EffectiveAddress {
  readonly base: RegisterName;
  readonly displacement: bigint;
}

/**
 * The teaching instruction subset, as a discriminated union on `op` so the
 * compiler forces exhaustive handling everywhere instructions are consumed.
 * Adding an instruction here should fail the build until its transition rule
 * (transitions.ts) and its trace-step description (describe.ts) both handle it.
 */
export type Instruction =
  | { readonly op: "mov"; readonly dst: RegisterName; readonly src: Operand }
  | { readonly op: "lea"; readonly dst: RegisterName; readonly address: EffectiveAddress }
  | { readonly op: "add"; readonly dst: RegisterName; readonly src: Operand }
  | { readonly op: "sub"; readonly dst: RegisterName; readonly src: Operand }
  | { readonly op: "inc"; readonly dst: RegisterName }
  | { readonly op: "dec"; readonly dst: RegisterName }
  | { readonly op: "imul"; readonly dst: RegisterName; readonly src: Operand }
  | { readonly op: "idiv"; readonly divisor: Operand }
  | { readonly op: "neg"; readonly dst: RegisterName }
  | { readonly op: "and"; readonly dst: RegisterName; readonly src: Operand }
  | { readonly op: "or"; readonly dst: RegisterName; readonly src: Operand }
  | { readonly op: "xor"; readonly dst: RegisterName; readonly src: Operand }
  | { readonly op: "not"; readonly dst: RegisterName }
  | { readonly op: "shl"; readonly dst: RegisterName; readonly count: Operand }
  | { readonly op: "shr"; readonly dst: RegisterName; readonly count: Operand }
  | { readonly op: "cmp"; readonly left: RegisterName; readonly right: Operand }
  | { readonly op: "test"; readonly left: RegisterName; readonly right: Operand }
  | { readonly op: "jmp"; readonly target: string }
  | { readonly op: "je"; readonly target: string }
  | { readonly op: "jne"; readonly target: string }
  | { readonly op: "jg"; readonly target: string }
  | { readonly op: "jl"; readonly target: string }
  | { readonly op: "jge"; readonly target: string }
  | { readonly op: "jle"; readonly target: string }
  | { readonly op: "loop"; readonly target: string }
  | { readonly op: "push"; readonly src: Operand }
  | { readonly op: "pop"; readonly dst: RegisterName }
  | { readonly op: "call"; readonly target: string }
  | { readonly op: "ret" }
  | { readonly op: "nop" };

export type InstructionOp = Instruction["op"];

export interface Flags {
  readonly zf: boolean;
  readonly sf: boolean;
  readonly cf: boolean;
  readonly of: boolean;
}

export type StackSlotKind = "value" | "return-address";

export interface StackSlot {
  readonly kind: StackSlotKind;
  readonly value: bigint;
  /** Which frame this slot visually belongs to; null means "before any call" (top-level). */
  readonly frameId: number | null;
  /** Only present on return-address slots: the instruction index execution resumes at. */
  readonly returnIp?: number;
}

export interface Frame {
  readonly id: number;
  readonly functionLabel: string;
  readonly returnIp: number;
}

export interface EngineState {
  readonly registers: Readonly<Record<RegisterName, bigint>>;
  readonly stack: readonly StackSlot[];
  readonly flags: Flags;
  readonly frames: readonly Frame[];
  readonly ip: number;
}

export type EngineFaultKind =
  | "stack-underflow"
  | "ret-without-call"
  | "ret-corrupted-stack"
  | "unknown-label"
  | "divide-by-zero"
  | "divide-overflow"
  | "step-limit-exceeded";

export interface EngineFault {
  readonly kind: EngineFaultKind;
  readonly atIp: number;
  readonly message: string;
}

/** Thrown internally by transition rules; caught by trace generation and turned into an EngineFault. */
export class EngineFaultError extends Error {
  constructor(
    public readonly kind: EngineFaultKind,
    message: string,
  ) {
    super(message);
    this.name = "EngineFaultError";
  }
}
