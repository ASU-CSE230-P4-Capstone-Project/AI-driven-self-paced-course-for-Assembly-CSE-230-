"use client";
import React from "react";
import Editor, { OnMount, BeforeMount, Monaco } from "@monaco-editor/react";
import type * as MonacoEditor from "monaco-editor";

const abiToReg: Record<string, string> = {
  zero: "x0",
  ra: "x1",
  sp: "x2",
  gp: "x3",
  tp: "x4",
  t0: "x5",
  t1: "x6",
  t2: "x7",
  s0: "x8",
  fp: "x8",
  s1: "x9",
  a0: "x10",
  a1: "x11",
  a2: "x12",
  a3: "x13",
  a4: "x14",
  a5: "x15",
  a6: "x16",
  a7: "x17",
  s2: "x18",
  s3: "x19",
  s4: "x20",
  s5: "x21",
  s6: "x22",
  s7: "x23",
  s8: "x24",
  s9: "x25",
  s10: "x26",
  s11: "x27",
  t3: "x28",
  t4: "x29",
  t5: "x30",
  t6: "x31",
};

const regToAbi: Record<string, string> = Object.fromEntries(
  Object.entries(abiToReg).map(([abi, reg]) => [reg, abi])
);

const abiRole: Record<string, string> = {
  zero: "hard-wired zero",
  ra: "return address (caller-saved)",
  sp: "stack pointer (callee-saved)",
  gp: "global pointer",
  tp: "thread pointer",
  t0: "temporary (caller-saved)",
  t1: "temporary (caller-saved)",
  t2: "temporary (caller-saved)",
  s0: "saved/frame pointer (callee-saved)",
  fp: "frame pointer (alias of s0)",
  s1: "saved (callee-saved)",
  a0: "arg/ret (caller-saved)",
  a1: "arg/ret (caller-saved)",
  a2: "arg (caller-saved)",
  a3: "arg (caller-saved)",
  a4: "arg (caller-saved)",
  a5: "arg (caller-saved)",
  a6: "arg (caller-saved)",
  a7: "arg (caller-saved)",
  s2: "saved (callee-saved)",
  s3: "saved (callee-saved)",
  s4: "saved (callee-saved)",
  s5: "saved (callee-saved)",
  s6: "saved (callee-saved)",
  s7: "saved (callee-saved)",
  s8: "saved (callee-saved)",
  s9: "saved (callee-saved)",
  s10: "saved (callee-saved)",
  s11: "saved (callee-saved)",
  t3: "temporary (caller-saved)",
  t4: "temporary (caller-saved)",
  t5: "temporary (caller-saved)",
  t6: "temporary (caller-saved)",
};

type CodeEditorProps = {
  code: string;
  onChange: (value: string) => void;
  currentLine?: number | null;
  className?: string;
  fontSize?: number;
  height?: string;
  onRun?: () => void; // optional (Ctrl+Enter)
};


export default function CodeEditor({
  code,
  onChange,
  currentLine,
  className,
  fontSize = 14,
  height = "28rem",
  onRun,
}: CodeEditorProps) {
  const editorRef = React.useRef<MonacoEditor.editor.IStandaloneCodeEditor | null>(null);
  const decorationsRef = React.useRef<string[]>([]);
  const monacoRef = React.useRef<Monaco | null>(null);
  const [isReady, setIsReady] = React.useState(false);
  const handleBeforeMount: BeforeMount = (m) => {
    // register once
    monacoRef.current=m;
    m.languages.register({ id: "riscv" });

    m.languages.setMonarchTokensProvider("riscv", {
      defaultToken: "",
      ignoreCase: true,
      tokenizer: {
        root: [
          [/#.*$/, "comment"],
          [/;.*$/, "comment"],
          [/^[ \t]*[A-Za-z_.$][\w.$]*:/, "type.identifier"],
          [/\b(x([0-9]|[12][0-9]|3[01])|zero|ra|sp|gp|tp|t[0-6]|s([0-9]|1[01])|a[0-7])\b/, "variable.predefined"],
          [/\b0x[0-9a-fA-F]+\b/, "number.hex"],
          [/\b-?\d+\b/, "number"],
          [/\.[A-Za-z_][\w.]*/, "keyword"],
          [
            /\b(sll|slli|srl|srli|sra|srai|add|sub|addi|lui|auipc|xor|or|and|xori|ori|andi|slt|slti|sltiu|sltu|beq|bne|blt|bge|bltu|bgeu|jal|jalr|fence|fence\.i|ecall|ebreak|lw|lh|lhu|lb|lbu|sw|sh|sb)\b/,
            "keyword.operator",
          ],
          [/[A-Za-z_.$][\w.$]*/, "identifier"],
          [/[,:()\[\]]/, "delimiter"],
          [/[+\-*/%&|^~!=<>]/, "operator"],
          [/[ \t\r\n]+/, ""],
        ],
      },
    });

    m.languages.setLanguageConfiguration("riscv", {
      comments: { lineComment: "#" },
      wordPattern: /[#@\-]?\w+(\.\w+)*/g,
    });

    // theme
    m.editor.defineTheme("riscv-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "6A9955" },
        { token: "keyword.operator", foreground: "C586C0" },
        { token: "keyword", foreground: "569CD6" },
        { token: "type.identifier", foreground: "DCDCAA" },
        { token: "variable.predefined", foreground: "4FC1FF" },
        { token: "number", foreground: "B5CEA8" },
        { token: "number.hex", foreground: "B5CEA8" },
      ],
      colors: {},
    });

    // completions
    m.languages.registerCompletionItemProvider("riscv", {
      provideCompletionItems: (
        _model: MonacoEditor.editor.ITextModel,
        position: MonacoEditor.Position
      ): { suggestions: MonacoEditor.languages.CompletionItem[] } => {
        const range = new m.Range(
          position.lineNumber,
          position.column,
          position.lineNumber,
          position.column
        );

        const opcodeLabels = [
          "sll","slli","srl","srli","sra","srai","add","sub","addi","lui",
          "auipc","xor","or","and","xori","ori","andi","slt","slti","sltiu",
          "sltu","beq","bne","blt","bge","bltu","bgeu","jal","jalr","fence",
          "fence.i","ecall","ebreak","lw","lh","lhu","lb","lbu","sw","sh","sb",
        ];
        const abiLabels = Object.keys(abiToReg);
        const xLabels = Array.from({ length: 32 }, (_, i) => `x${i}`);

        const suggestions: MonacoEditor.languages.CompletionItem[] = [
          ...opcodeLabels.map((k) => ({
            label: k,
            kind: m.languages.CompletionItemKind.Keyword,
            insertText: k,
            range,
          })),
          ...abiLabels.map((abi) => ({
            label: abi,
            kind: m.languages.CompletionItemKind.Variable,
            insertText: abi,
            detail: `${abiToReg[abi]} • ${abiRole[abi] ?? ""}`,
            documentation: `${abi} = ${abiToReg[abi]} (${abiRole[abi] ?? "ABI register"})`,
            range,
          })),
          ...xLabels.map((x) => ({
            label: x,
            kind: m.languages.CompletionItemKind.Variable,
            insertText: x,
            detail: `${regToAbi[x] ?? ""}${regToAbi[x] ? " • " : ""}${abiRole[regToAbi[x] ?? ""] ?? ""}`,
            documentation: `${x}${regToAbi[x] ? ` = ${regToAbi[x]} (${abiRole[regToAbi[x]] ?? "register"})` : ""}`,
            range,
          })),
        ];

        return { suggestions };
      },
      triggerCharacters: [".", "x", "a", "s", "t", "r", "g", "z", "f"],
    });

    // hover
    m.languages.registerHoverProvider("riscv", {
      provideHover(
        model: MonacoEditor.editor.ITextModel,
        position: MonacoEditor.Position
      ) {
        const word = model.getWordAtPosition(position);
        if (!word) return { contents: [] };
        const w = word.word;
        if (abiToReg[w]) {
          const x = abiToReg[w];
          const role = abiRole[w] ?? "ABI register";
          return { contents: [{ value: `**${w}**  \`${x}\`` }, { value: role }] };
        }
        if (/^x([0-9]|[12][0-9]|3[01])$/.test(w)) {
          const abi = regToAbi[w];
          const role = abi ? (abiRole[abi] ?? "register") : "register";
          return { contents: [{ value: `**${w}**${abi ? `  \`${abi}\`` : ""}` }, { value: role }] };
        }
        return { contents: [] };
      },
    });
  }

  const handleOnMount: OnMount = (editor, m) => {
    editorRef.current = editor;
    monacoRef.current = m;
    if (!m) return;
    // Ctrl/Cmd + Enter → run
    if (onRun) {
      editor.addCommand(m.KeyMod.CtrlCmd | m.KeyCode.Enter, () => onRun());
    }
    setIsReady(true);
  };

  // when currentLine changes → update decorations
  React.useEffect(() => {
    const ed = editorRef.current;
    const m = monacoRef.current;
    if (!m) return;
    if (!ed) return;

    // clear old
    decorationsRef.current = ed.deltaDecorations(decorationsRef.current, []);

    if (currentLine && currentLine > 0) {
      decorationsRef.current = ed.deltaDecorations(decorationsRef.current, [
        {
          range: new m.Range(currentLine, 1, currentLine, 1),
          options: {
            isWholeLine: true,
            className: "current-line-highlight",
          },
        },
      ]);
    }
  }, [currentLine]);

  React.useEffect(() => {
    const ed = editorRef.current;
    if (!ed) return;
    const model = ed.getModel();
    if (!model) return;
    if (model.getValue() !== code) {
      ed.setValue(code);
    }
  }, [code]);

  return (
    <div
      className={`relative ${className ?? ""}`.trim()}
      style={{ width: "100%", height }}
    >
      {!isReady && (
        <div className="absolute inset-0 z-10 animate-pulse rounded-xl border-2 border-orange-300 bg-zinc-900/60">
          <div className="p-4">
            <div className="h-3 w-1/3 rounded bg-zinc-700/60" />
            <div className="mt-2 space-y-2">
              <div className="h-2 w-5/6 rounded bg-zinc-800/80" />
              <div className="h-2 w-4/6 rounded bg-zinc-800/80" />
              <div className="h-2 w-3/6 rounded bg-zinc-800/80" />
            </div>
          </div>
        </div>
      )}
      <Editor
        height={height}
        language="riscv"
        theme="riscv-dark"
        value={code}
        onChange={(val) => onChange(val ?? "")}
        beforeMount={handleBeforeMount}
        onMount={handleOnMount}
        options={{
          fontSize,
          fontLigatures: true,
          minimap: { enabled: false },
          automaticLayout: true,
          tabSize: 4,
          insertSpaces: true,
          wordWrap: "off",
          scrollBeyondLastLine: true,
          renderWhitespace: "none",
          smoothScrolling: true,
          glyphMargin: false,
          lineNumbersMinChars: 3,
          lineDecorationsWidth: 0,
          scrollbar: { horizontal: "visible" },
        }}
        className="rounded-xl overflow-hidden border-orange-300 border-2"
      />
    </div>
  );
}
