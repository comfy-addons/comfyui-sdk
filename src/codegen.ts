import { NodeDef, NodeDefsResponse } from "./types/api";

export interface GenerateWorkflowCodeOptions {
  sdkImportPath?: string;
  className?: string;
  enumOverrides?: Record<string, string[]>;
}

const TS_KEYWORDS = new Set<string>([
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "enum",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "function",
  "if",
  "implements",
  "import",
  "in",
  "instanceof",
  "interface",
  "let",
  "new",
  "null",
  "package",
  "private",
  "protected",
  "public",
  "return",
  "static",
  "super",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "typeof",
  "var",
  "void",
  "while",
  "with",
  "yield"
]);

function isValidIdentifier(value: string): boolean {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value) && !TS_KEYWORDS.has(value);
}

function quoteKey(value: string): string {
  if (isValidIdentifier(value)) {
    return value;
  }
  return JSON.stringify(value);
}

function toPascalCase(value: string): string {
  const words = value
    .split(/[^A-Za-z0-9_$]+/g)
    .filter(Boolean)
    .map((word) => `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`);
  let name = words.join("");
  if (!name) {
    name = "Node";
  }
  if (/^\d/.test(name)) {
    name = `Node${name}`;
  }
  if (TS_KEYWORDS.has(name)) {
    name = `${name}Node`;
  }
  return name;
}

function uniqueName(base: string, used: Set<string>): string {
  if (!used.has(base)) {
    used.add(base);
    return base;
  }

  let index = 2;
  let candidate = `${base}${index}`;
  while (used.has(candidate)) {
    index += 1;
    candidate = `${base}${index}`;
  }
  used.add(candidate);
  return candidate;
}

function orderedKeys(definition: Record<string, unknown>, order?: string[]): string[] {
  const keys = Object.keys(definition);
  if (!order || order.length === 0) {
    return keys;
  }

  const seen = new Set<string>();
  const result: string[] = [];
  for (const key of order) {
    if (!seen.has(key) && key in definition) {
      seen.add(key);
      result.push(key);
    }
  }
  for (const key of keys) {
    if (!seen.has(key)) {
      seen.add(key);
      result.push(key);
    }
  }
  return result;
}

function enumType(values: unknown[]): string {
  const asStrings = values.filter((value): value is string => typeof value === "string");
  if (asStrings.length === 0) {
    return "string";
  }
  return asStrings.map((value) => JSON.stringify(value)).join(" | ");
}

function inputType(inputDef: unknown, enumOverride?: string[]): string {
  if (!Array.isArray(inputDef) || inputDef.length === 0) {
    return "unknown";
  }

  if (Array.isArray(enumOverride) && enumOverride.length > 0) {
    return enumType(enumOverride);
  }

  const head = inputDef[0];
  if (Array.isArray(head)) {
    return enumType(head);
  }
  if (head === "COMBO") {
    const config = inputDef[1];
    if (config && typeof config === "object" && Array.isArray((config as { options?: unknown[] }).options)) {
      return enumType((config as { options: unknown[] }).options);
    }
    return "string";
  }
  if (head === "INT" || head === "FLOAT") {
    return "number";
  }
  if (head === "STRING") {
    return "string";
  }
  if (head === "BOOLEAN") {
    return "boolean";
  }
  if (head === "*") {
    return "NodeRef";
  }
  if (typeof head === "string") {
    return `NodeRef<${JSON.stringify(head)}>`;
  }
  return "unknown";
}

function nodeRefTypeParam(value: unknown): string {
  if (Array.isArray(value)) {
    const options = value.filter((entry): entry is string => typeof entry === "string");
    if (options.length === 0) {
      return "string";
    }
    return options.map((entry) => JSON.stringify(entry)).join(" | ");
  }
  if (typeof value === "string") {
    if (value === "*") {
      return "string";
    }
    return JSON.stringify(value);
  }
  return "string";
}

function outputType(value: unknown): string {
  const typeParam = nodeRefTypeParam(value);
  if (typeParam === "string") {
    return "NodeRef";
  }
  return `NodeRef<${typeParam}>`;
}

function buildInputLines(nodeName: string, nodeDef: NodeDef, options?: GenerateWorkflowCodeOptions): string[] {
  const required = nodeDef.input?.required ?? {};
  const optional = nodeDef.input?.optional ?? {};
  const requiredKeys = orderedKeys(required, nodeDef.input_order?.required);
  const optionalKeys = orderedKeys(optional, nodeDef.input_order?.optional);
  const lines: string[] = [];

  for (const key of requiredKeys) {
    const override = options?.enumOverrides?.[`${nodeName}.${key}`];
    lines.push(`  ${quoteKey(key)}: ${inputType(required[key], override)};`);
  }
  for (const key of optionalKeys) {
    const override = options?.enumOverrides?.[`${nodeName}.${key}`];
    lines.push(`  ${quoteKey(key)}?: ${inputType(optional[key], override)};`);
  }

  return lines;
}

function buildInputPathLines(nodeDef: NodeDef): Array<{ key: string; path: string }> {
  const required = nodeDef.input?.required ?? {};
  const optional = nodeDef.input?.optional ?? {};
  const requiredKeys = orderedKeys(required, nodeDef.input_order?.required);
  const optionalKeys = orderedKeys(optional, nodeDef.input_order?.optional);
  const keys: string[] = [];
  const seen = new Set<string>();

  for (const key of [...requiredKeys, ...optionalKeys]) {
    if (!seen.has(key)) {
      seen.add(key);
      keys.push(key);
    }
  }

  return keys.map((key) => ({ key, path: `\${id}.inputs.${key}` }));
}

function buildOutputLines(nodeDef: NodeDef): Array<{ key: string; type: string; refTypeParam: string; index: number }> {
  const outputNames = Array.isArray(nodeDef.output_name) ? nodeDef.output_name : [];
  const outputs = Array.isArray(nodeDef.output) ? (nodeDef.output as unknown[]) : [];
  const max = Math.max(outputNames.length, outputs.length);
  const lines: Array<{ key: string; type: string; refTypeParam: string; index: number }> = [];

  for (let index = 0; index < max; index += 1) {
    const outputValue = outputs[index];
    lines.push({
      key: outputNames[index] || `OUTPUT_${index}`,
      type: outputType(outputValue),
      refTypeParam: nodeRefTypeParam(outputValue),
      index
    });
  }

  return lines;
}

export function generateWorkflowCode(nodeDefs: NodeDefsResponse, options?: GenerateWorkflowCodeOptions): string {
  const sdkImportPath = options?.sdkImportPath ?? "@saintno/comfyui-sdk";
  const className = options?.className ?? "WorkflowBuilder";
  const keys = Object.keys(nodeDefs).sort((a, b) => a.localeCompare(b));
  const usedNames = new Set<string>();
  const interfaces: string[] = [];
  const methods: string[] = [];

  for (const key of keys) {
    const nodeDef = nodeDefs[key];
    const safeName = uniqueName(toPascalCase(key), usedNames);
    const inputInterfaceName = `${safeName}Inputs`;
    const inputPathsInterfaceName = `${safeName}InputPaths`;
    const outputInterfaceName = `${safeName}Outputs`;
    const inputLines = buildInputLines(key, nodeDef, options);
    const inputPathLines = buildInputPathLines(nodeDef);
    const outputLines = buildOutputLines(nodeDef);

    interfaces.push(`export interface ${inputInterfaceName} {`);
    if (inputLines.length === 0) {
      interfaces.push(`}`);
    } else {
      interfaces.push(...inputLines);
      interfaces.push(`}`);
    }
    interfaces.push("");

    interfaces.push(`export interface ${inputPathsInterfaceName} {`);
    for (const inputPathLine of inputPathLines) {
      interfaces.push(`  ${quoteKey(inputPathLine.key)}: string;`);
    }
    interfaces.push(`}`);
    interfaces.push("");

    if (outputLines.length > 0) {
      interfaces.push(`export interface ${outputInterfaceName} {`);
      for (const output of outputLines) {
        interfaces.push(`  ${quoteKey(output.key)}: ${output.type};`);
      }
      interfaces.push(`}`);
      interfaces.push("");
    }

    const methodHeader = outputLines.length
      ? `  ${safeName}(inputs: ${inputInterfaceName}${inputLines.length === 0 ? " = {}" : ""}): ${outputInterfaceName} & { __id: string; inputs: ${inputPathsInterfaceName} } {`
      : `  ${safeName}(inputs: ${inputInterfaceName}${inputLines.length === 0 ? " = {}" : ""}): { __id: string; inputs: ${inputPathsInterfaceName} } {`;

    if (safeName === key) {
      methods.push(methodHeader);
    } else {
      methods.push(`  /** Node: ${JSON.stringify(key)} */`);
      methods.push(methodHeader);
    }
    methods.push(`    const id = this.addNode(${JSON.stringify(key)}, inputs);`);
    methods.push("    const inputPaths = {");
    for (const inputPathLine of inputPathLines) {
      methods.push(`      ${quoteKey(inputPathLine.key)}: \`${inputPathLine.path}\`,`);
    }
    methods.push("    };");
    if (outputLines.length > 0) {
      methods.push("    return {");
      for (const output of outputLines) {
        methods.push(
          `      ${quoteKey(output.key)}: this.makeRef<${output.refTypeParam}>(id, ${output.index}),`
        );
      }
      methods.push("      __id: id,");
      methods.push("      inputs: inputPaths");
      methods.push("    };");
    } else {
      methods.push("    return { __id: id, inputs: inputPaths };");
    }
    methods.push("  }");
    methods.push("");
  }

  return [
    "// Auto-generated by cfli codegen. Do not edit manually.",
    `import { WorkflowBuilder as BaseWorkflowBuilder, NodeRef } from ${JSON.stringify(sdkImportPath)};`,
    "",
    ...interfaces,
    `export class ${className} extends BaseWorkflowBuilder {`,
    ...methods,
    "}"
  ].join("\n");
}
