export { REGISTER_NAMES, INITIAL_RSP, isRegisterName, type RegisterName } from "./constants";
export { toSigned64, wrap64 } from "./bigint-utils";
export { createInitialState } from "./state";
export { buildProgram, type Program } from "./program";
export { parseProgram, type ParseError, type ParseResult } from "./parser";
export { step } from "./transitions";
export {
  generateTrace,
  stateAtStep,
  firstStepForInstruction,
  seekTargetForInstruction,
  type Trace,
  type TraceStep,
  type StepDelta,
  type StackChangeKind,
} from "./trace";
export type {
  EffectiveAddress,
  EngineFault,
  EngineState,
  Flags,
  Frame,
  Instruction,
  InstructionOp,
  Operand,
  StackSlot,
} from "./types";
