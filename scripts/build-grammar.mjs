import { buildParserFile } from "@lezer/generator";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const grammarPath = resolve(root, "lib/editor/assembly.grammar");
const outPath = resolve(root, "lib/editor/assembly.parser.js");
const typesPath = resolve(root, "lib/editor/assembly.parser.d.ts");

const { parser, terms } = buildParserFile(readFileSync(grammarPath, "utf8"), {
  fileName: grammarPath,
  moduleStyle: "es",
});

writeFileSync(outPath, `// Generated from assembly.grammar by scripts/build-grammar.mjs. Do not edit.\n${parser}`);
writeFileSync(
  typesPath,
  `// Generated from assembly.grammar by scripts/build-grammar.mjs. Do not edit.\nimport { LRParser } from "@lezer/lr";\nexport declare const parser: LRParser;\n`,
);
writeFileSync(
  resolve(root, "lib/editor/assembly.terms.js"),
  `// Generated from assembly.grammar by scripts/build-grammar.mjs. Do not edit.\n${terms}`,
);

console.log("Built Lezer parser from assembly.grammar");
