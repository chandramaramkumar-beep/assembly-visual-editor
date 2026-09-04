import { INITIAL_RSP, REGISTER_NAMES, type RegisterName } from "./constants";
import { wrap64 } from "./bigint-utils";
import type { EngineState, Operand } from "./types";

export function createInitialState(): EngineState {
  const registers = Object.fromEntries(
    REGISTER_NAMES.map((name) => [name, name === "rsp" ? INITIAL_RSP : 0n]),
  ) as Record<RegisterName, bigint>;

  return {
    registers,
    stack: [],
    flags: { zf: false, sf: false, cf: false, of: false },
    frames: [],
    ip: 0,
  };
}

export function readRegister(state: EngineState, name: RegisterName): bigint {
  return state.registers[name];
}

export function writeRegister(
  state: EngineState,
  name: RegisterName,
  value: bigint,
): EngineState {
  return {
    ...state,
    registers: { ...state.registers, [name]: wrap64(value) },
  };
}

export function evaluateOperand(state: EngineState, operand: Operand): bigint {
  return operand.kind === "register" ? readRegister(state, operand.name) : wrap64(operand.value);
}

export function currentFrameId(state: EngineState): number | null {
  const frame = state.frames[state.frames.length - 1];
  return frame ? frame.id : null;
}
