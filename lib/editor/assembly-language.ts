import { LRLanguage, LanguageSupport } from "@codemirror/language";
import { styleTags, tags } from "@lezer/highlight";
import { parser } from "./assembly.parser.js";

const assemblyLanguage = LRLanguage.define({
  parser: parser.configure({
    props: [
      styleTags({
        Mnemonic: tags.keyword,
        Register: tags.variableName,
        Number: tags.number,
        Comment: tags.comment,
        "LabelDef/Identifier": tags.labelName,
        Identifier: tags.labelName,
        "[ ]": tags.bracket,
      }),
    ],
  }),
  languageData: {
    commentTokens: { line: ";" },
  },
});

export function assembly(): LanguageSupport {
  return new LanguageSupport(assemblyLanguage);
}
