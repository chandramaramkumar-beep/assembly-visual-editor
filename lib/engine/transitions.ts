import { toSigned64, wrap64 } from "./bigint-utils";
import { MAX_SIGNED_64, MIN_SIGNED_64 } from "./constants";
import {
  addFlags,
  decFlags,
  imulFlags,
  incFlags,
  logicFlags,
  negFlags,
  shlFlags,
  shrFlags,
  subFlags,
} from "./flags";
import type { Program } from "./program";
import { resolveLabel } from "./program";
import { currentFrameId, evaluateOperand, readRegister, writeRegister } from "./state";
import type { EngineState, Instruction, StackSlot } from "./types";
import { EngineFaultError } from "./types";

function jump(state: EngineState, program: Program, target: string): EngineState {
  const ip = resolveLabel(program, target);
  if (ip === undefined) {
    throw new EngineFaultError("unknown-label", `Unknown label "${target}"`);
  }
  return { ...state, ip };
}

function next(state: EngineState): EngineState {
  return { ...state, ip: state.ip + 1 };
}

function pushSlot(state: EngineState, slot: Omit<StackSlot, "frameId">): EngineState {
  return {
    ...state,
    stack: [...state.stack, { ...slot, frameId: currentFrameId(state) }],
    registers: { ...state.registers, rsp: wrap64(state.registers.rsp - 8n) },
  };
}

function popSlot(state: EngineState): { slot: StackSlot; state: EngineState } {
  const top = state.stack[state.stack.length - 1];
  if (!top) {
    throw new EngineFaultError("stack-underflow", "Pop/ret with an empty stack");
  }
  return {
    slot: top,
    state: {
      ...state,
      stack: state.stack.slice(0, -1),
      registers: { ...state.registers, rsp: wrap64(state.registers.rsp + 8n) },
    },
  };
}

/** One pure transition: given the current state and the instruction at `state.ip`, compute the next state. */
export function step(state: EngineState, instruction: Instruction, program: Program): EngineState {
  switch (instruction.op) {
    case "mov": {
      const value = evaluateOperand(state, instruction.src);
      return next(writeRegister(state, instruction.dst, value));
    }

    case "lea": {
      const { base, displacement } = instruction.address;
      const value = wrap64(readRegister(state, base) + displacement);
      return next(writeRegister(state, instruction.dst, value));
    }

    case "add": {
      const a = readRegister(state, instruction.dst);
      const b = evaluateOperand(state, instruction.src);
      const flags = addFlags(a, b);
      return next({ ...writeRegister(state, instruction.dst, a + b), flags });
    }

    case "sub": {
      const a = readRegister(state, instruction.dst);
      const b = evaluateOperand(state, instruction.src);
      const flags = subFlags(a, b);
      return next({ ...writeRegister(state, instruction.dst, a - b), flags });
    }

    case "inc": {
      const a = readRegister(state, instruction.dst);
      const flags = incFlags(a, state.flags.cf);
      return next({ ...writeRegister(state, instruction.dst, a + 1n), flags });
    }

    case "dec": {
      const a = readRegister(state, instruction.dst);
      const flags = decFlags(a, state.flags.cf);
      return next({ ...writeRegister(state, instruction.dst, a - 1n), flags });
    }

    case "imul": {
      const a = toSigned64(readRegister(state, instruction.dst));
      const b = toSigned64(evaluateOperand(state, instruction.src));
      const fullProduct = a * b;
      const truncated = toSigned64(wrap64(fullProduct));
      const { cf, of } = imulFlags(fullProduct, truncated);
      return next({
        ...writeRegister(state, instruction.dst, wrap64(fullProduct)),
        flags: { ...state.flags, cf, of },
      });
    }

    case "idiv": {
      const dividend =
        (toSigned64(readRegister(state, "rdx")) << 64n) | (readRegister(state, "rax") & ((1n << 64n) - 1n));
      const divisor = toSigned64(evaluateOperand(state, instruction.divisor));
      if (divisor === 0n) {
        throw new EngineFaultError("divide-by-zero", "idiv by zero");
      }
      const quotient = dividend / divisor;
      const remainder = dividend % divisor;
      if (quotient < MIN_SIGNED_64 || quotient > MAX_SIGNED_64) {
        throw new EngineFaultError("divide-overflow", "idiv quotient does not fit in 64 bits");
      }
      const withRax = writeRegister(state, "rax", wrap64(quotient));
      const withRdx = writeRegister(withRax, "rdx", wrap64(remainder));
      return next(withRdx);
    }

    case "neg": {
      const a = readRegister(state, instruction.dst);
      const flags = negFlags(a);
      return next({ ...writeRegister(state, instruction.dst, -a), flags });
    }

    case "and": {
      const result = readRegister(state, instruction.dst) & evaluateOperand(state, instruction.src);
      return next({ ...writeRegister(state, instruction.dst, result), flags: logicFlags(result) });
    }

    case "or": {
      const result = readRegister(state, instruction.dst) | evaluateOperand(state, instruction.src);
      return next({ ...writeRegister(state, instruction.dst, result), flags: logicFlags(result) });
    }

    case "xor": {
      const result = readRegister(state, instruction.dst) ^ evaluateOperand(state, instruction.src);
      return next({ ...writeRegister(state, instruction.dst, result), flags: logicFlags(result) });
    }

    case "not": {
      const result = wrap64(~readRegister(state, instruction.dst));
      return next(writeRegister(state, instruction.dst, result));
    }

    case "shl": {
      const original = readRegister(state, instruction.dst);
      const count = evaluateOperand(state, instruction.count) & 63n;
      if (count === 0n) return next(state);
      const result = wrap64(original << count);
      return next({
        ...writeRegister(state, instruction.dst, result),
        flags: shlFlags(original, count, result),
      });
    }

    case "shr": {
      const original = readRegister(state, instruction.dst);
      const count = evaluateOperand(state, instruction.count) & 63n;
      if (count === 0n) return next(state);
      const result = wrap64(original >> count);
      return next({
        ...writeRegister(state, instruction.dst, result),
        flags: shrFlags(original, count, result),
      });
    }

    case "cmp": {
      const a = readRegister(state, instruction.left);
      const b = evaluateOperand(state, instruction.right);
      return next({ ...state, flags: subFlags(a, b) });
    }

    case "test": {
      const a = readRegister(state, instruction.left);
      const b = evaluateOperand(state, instruction.right);
      return next({ ...state, flags: logicFlags(a & b) });
    }

    case "jmp":
      return jump(state, program, instruction.target);

    case "je":
      return state.flags.zf ? jump(state, program, instruction.target) : next(state);

    case "jne":
      return !state.flags.zf ? jump(state, program, instruction.target) : next(state);

    case "jg":
      return !state.flags.zf && state.flags.sf === state.flags.of
        ? jump(state, program, instruction.target)
        : next(state);

    case "jl":
      return state.flags.sf !== state.flags.of ? jump(state, program, instruction.target) : next(state);

    case "jge":
      return state.flags.sf === state.flags.of ? jump(state, program, instruction.target) : next(state);

    case "jle":
      return state.flags.zf || state.flags.sf !== state.flags.of
        ? jump(state, program, instruction.target)
        : next(state);

    case "loop": {
      const count = wrap64(readRegister(state, "rcx") - 1n);
      const withCount = writeRegister(state, "rcx", count);
      return count !== 0n ? jump(withCount, program, instruction.target) : next(withCount);
    }

    case "push": {
      const value = evaluateOperand(state, instruction.src);
      return next(pushSlot(state, { kind: "value", value }));
    }

    case "pop": {
      const { slot, state: popped } = popSlot(state);
      return next(writeRegister(popped, instruction.dst, slot.value));
    }

    case "call": {
      const targetIp = resolveLabel(program, instruction.target);
      if (targetIp === undefined) {
        throw new EngineFaultError("unknown-label", `Unknown label "${instruction.target}"`);
      }
      const returnIp = state.ip + 1;
      const frameId = state.frames.length;
      const withFrame: EngineState = {
        ...state,
        frames: [...state.frames, { id: frameId, functionLabel: instruction.target, returnIp }],
      };
      const withReturnSlot = pushSlot(withFrame, {
        kind: "return-address",
        value: BigInt(returnIp),
        returnIp,
      });
      return { ...withReturnSlot, ip: targetIp };
    }

    case "ret": {
      if (state.frames.length === 0) {
        throw new EngineFaultError("ret-without-call", "ret with no matching call");
      }
      const { slot, state: popped } = popSlot(state);
      if (slot.kind !== "return-address" || slot.returnIp === undefined) {
        throw new EngineFaultError(
          "ret-corrupted-stack",
          "ret popped a value that was not the return address — the stack was not cleaned up before ret",
        );
      }
      return { ...popped, frames: popped.frames.slice(0, -1), ip: slot.returnIp };
    }

    case "nop":
      return next(state);
  }
}
