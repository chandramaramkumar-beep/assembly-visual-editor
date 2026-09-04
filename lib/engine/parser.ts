import { isRegisterName, type RegisterName } from "./constants";
import { buildProgram, type Program } from "./program";
import type { EffectiveAddress, Instruction, Operand } from "./types";

export interface ParseError {
  /** 0-based line number in the source text. */
  readonly line: number;
  readonly message: string;
}

export interface ParseResult {
  readonly program: Program;
  readonly errors: readonly ParseError[];
  /** Source line number for each instruction, so the UI can highlight the right line per trace step. */
  readonly instructionLines: readonly number[];
}

const REGISTER_ONLY_OPS = new Set(["inc", "dec", "neg", "not", "pop"]);
const JUMP_OPS = new Set(["jmp", "je", "jne", "jg", "jl", "jge", "jle", "loop", "call"]);
const TWO_OPERAND_OPS = new Set([
  "mov", "add", "sub", "imul", "and", "or", "xor", "shl", "shr", "cmp", "test",
]);

function stripComment(line: string): string {
  const index = line.indexOf(";");
  return index === -1 ? line : line.slice(0, index);
}

function parseImmediate(token: string): bigint | null {
  const text = token.trim();
  try {
    if (/^-?0x[0-9a-f]+$/i.test(text)) {
      return text.startsWith("-") ? -BigInt(text.slice(1)) : BigInt(text);
    }
    if (/^-?\d+$/.test(text)) return BigInt(text);
  } catch {
    return null;
  }
  return null;
}

function parseOperand(token: string): Operand | null {
  const text = token.trim().toLowerCase();
  if (isRegisterName(text)) return { kind: "register", name: text };
  const immediate = parseImmediate(text);
  return immediate === null ? null : { kind: "immediate", value: immediate };
}

function parseRegister(token: string): RegisterName | null {
  const text = token.trim().toLowerCase();
  return isRegisterName(text) ? text : null;
}

/** Parses `[rbp-8]`, `[rsp+16]`, `[rax]`. Address arithmetic only — nothing is dereferenced. */
function parseEffectiveAddress(token: string): EffectiveAddress | null {
  const match = /^\[\s*([a-z0-9]+)\s*(?:([+-])\s*(0x[0-9a-f]+|\d+)\s*)?\]$/i.exec(token.trim());
  if (!match) return null;

  const base = parseRegister(match[1]);
  if (!base) return null;

  if (!match[2]) return { base, displacement: 0n };

  const magnitude = parseImmediate(match[3]);
  if (magnitude === null) return null;

  return { base, displacement: match[2] === "-" ? -magnitude : magnitude };
}

function splitOperands(text: string): string[] {
  return text.split(",").map((part) => part.trim()).filter((part) => part.length > 0);
}

function parseInstruction(
  mnemonic: string,
  operands: readonly string[],
): { instruction: Instruction } | { error: string } {
  const op = mnemonic.toLowerCase();

  if (op === "nop") {
    return operands.length === 0
      ? { instruction: { op: "nop" } }
      : { error: "nop takes no operands" };
  }

  if (op === "ret") {
    return operands.length === 0
      ? { instruction: { op: "ret" } }
      : { error: "ret takes no operands" };
  }

  if (op === "push") {
    if (operands.length !== 1) return { error: "push takes exactly one operand" };
    const src = parseOperand(operands[0]);
    return src ? { instruction: { op: "push", src } } : { error: `Invalid operand "${operands[0]}"` };
  }

  if (op === "lea") {
    if (operands.length !== 2) return { error: "lea takes a destination register and an address" };
    const dst = parseRegister(operands[0]);
    if (!dst) return { error: `"${operands[0]}" is not a register` };
    const address = parseEffectiveAddress(operands[1]);
    return address
      ? { instruction: { op: "lea", dst, address } }
      : { error: `"${operands[1]}" is not a valid address like [rbp-8]` };
  }

  if (op === "idiv") {
    if (operands.length !== 1) return { error: "idiv takes exactly one operand" };
    const divisor = parseOperand(operands[0]);
    return divisor
      ? { instruction: { op: "idiv", divisor } }
      : { error: `Invalid operand "${operands[0]}"` };
  }

  if (REGISTER_ONLY_OPS.has(op)) {
    if (operands.length !== 1) return { error: `${op} takes exactly one register` };
    const dst = parseRegister(operands[0]);
    if (!dst) return { error: `"${operands[0]}" is not a register` };
    return {
      instruction: { op: op as "inc" | "dec" | "neg" | "not" | "pop", dst },
    };
  }

  if (JUMP_OPS.has(op)) {
    if (operands.length !== 1) return { error: `${op} takes exactly one label` };
    const target = operands[0].trim();
    if (!/^[a-z_][a-z0-9_]*$/i.test(target)) return { error: `"${target}" is not a valid label` };
    return {
      instruction: {
        op: op as "jmp" | "je" | "jne" | "jg" | "jl" | "jge" | "jle" | "loop" | "call",
        target,
      },
    };
  }

  if (TWO_OPERAND_OPS.has(op)) {
    if (operands.length !== 2) return { error: `${op} takes two operands` };
    const dst = parseRegister(operands[0]);
    if (!dst) return { error: `"${operands[0]}" is not a register` };
    const src = parseOperand(operands[1]);
    if (!src) return { error: `Invalid operand "${operands[1]}"` };

    if (op === "shl" || op === "shr") {
      return { instruction: { op, dst, count: src } };
    }
    if (op === "cmp" || op === "test") {
      return { instruction: { op, left: dst, right: src } };
    }
    return {
      instruction: { op: op as "mov" | "add" | "sub" | "imul" | "and" | "or" | "xor", dst, src },
    };
  }

  return { error: `Unknown instruction "${mnemonic}"` };
}

/**
 * Parses source text into a Program. Never throws — unparseable lines are
 * reported in `errors` and skipped, so the editor can show live feedback
 * while the student is still mid-typing.
 */
export function parseProgram(source: string): ParseResult {
  const instructions: Instruction[] = [];
  const instructionLines: number[] = [];
  const labels = new Map<string, number>();
  const errors: ParseError[] = [];

  source.split("\n").forEach((rawLine, lineNumber) => {
    let text = stripComment(rawLine).trim();
    if (text.length === 0) return;

    const labelMatch = /^([a-z_][a-z0-9_]*)\s*:\s*(.*)$/i.exec(text);
    if (labelMatch) {
      const name = labelMatch[1];
      if (labels.has(name)) {
        errors.push({ line: lineNumber, message: `Label "${name}" is defined more than once` });
      } else {
        labels.set(name, instructions.length);
      }
      text = labelMatch[2].trim();
      if (text.length === 0) return;
    }

    const [mnemonic, ...rest] = text.split(/\s+/);
    const result = parseInstruction(mnemonic, splitOperands(rest.join(" ")));

    if ("error" in result) {
      errors.push({ line: lineNumber, message: result.error });
      return;
    }

    instructions.push(result.instruction);
    instructionLines.push(lineNumber);
  });

  instructions.forEach((instruction, index) => {
    if ("target" in instruction && !labels.has(instruction.target)) {
      errors.push({
        line: instructionLines[index],
        message: `Unknown label "${instruction.target}"`,
      });
    }
  });

  return { program: buildProgram(instructions, labels), errors, instructionLines };
}
