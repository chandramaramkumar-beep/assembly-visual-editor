import { describe, expect, it } from "vitest";
import { parser } from "../assembly.parser.js";

function nodeNames(source: string): string[] {
  const names: string[] = [];
  parser.parse(source).iterate({
    enter(node: { name: string }) {
      names.push(node.name);
    },
  });
  return names;
}

function hasError(source: string): boolean {
  return nodeNames(source).includes("⚠");
}

describe("assembly Lezer grammar", () => {
  it("tokenizes a register/immediate instruction", () => {
    const names = nodeNames("mov rax, 10\n");
    expect(names).toContain("Mnemonic");
    expect(names).toContain("Register");
    expect(names).toContain("Number");
    expect(hasError("mov rax, 10\n")).toBe(false);
  });

  it("recognizes labels and jump targets", () => {
    const names = nodeNames("loop_start:\n  jmp loop_start\n");
    expect(names).toContain("LabelDef");
    expect(names).toContain("Mnemonic");
    expect(names).toContain("Identifier");
  });

  it("recognizes memory references with displacement", () => {
    const names = nodeNames("lea rax, [rbp-8]\n");
    expect(names).toContain("MemoryRef");
    expect(names).toContain("Register");
    expect(names).toContain("Number");
  });

  it("treats semicolon text as a comment", () => {
    const names = nodeNames("mov rax, 1 ; set up counter\n");
    expect(names).toContain("Comment");
    expect(hasError("mov rax, 1 ; set up counter\n")).toBe(false);
  });

  it("parses a whole multi-line program without errors", () => {
    const source = [
      "  mov rcx, 3",
      "  xor rax, rax",
      "body:",
      "  push rax",
      "  inc rax",
      "  loop body",
      "  call helper",
      "  ret",
      "helper:",
      "  nop",
      "  ret",
      "",
    ].join("\n");
    expect(hasError(source)).toBe(false);
  });

  it("recognizes hex immediates", () => {
    expect(nodeNames("mov rax, 0xff\n")).toContain("Number");
  });

  it("recognizes r8-r15 as registers, not identifiers", () => {
    const names = nodeNames("mov r15, r8\n");
    expect(names.filter((n) => n === "Register")).toHaveLength(2);
  });
});
