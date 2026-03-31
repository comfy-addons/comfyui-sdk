export interface ParsedOverride {
  key: string;
  value: string;
}

export function parseOverride(raw: string): ParsedOverride {
  const eqIndex = raw.indexOf("=");
  if (eqIndex === -1) {
    throw new Error(`Invalid override "${raw}": must contain "="`);
  }
  const key = raw.slice(0, eqIndex);
  const value = raw.slice(eqIndex + 1);
  if (key.length === 0) {
    throw new Error(`Invalid override "${raw}": key cannot be empty`);
  }
  return { key, value };
}

export function coerceValue(raw: string): string | number | boolean | any[] {
  if (raw === "true") return true;
  if (raw === "false") return false;

  if (/^\d+$/.test(raw)) {
    if (raw === "0" || raw[0] !== "0") {
      return Number(raw);
    }
    return raw;
  }

  if (/^\d+\.\d+$/.test(raw)) {
    return Number(raw);
  }

  if (raw[0] === "[" || raw[0] === "{") {
    return JSON.parse(raw);
  }

  return raw;
}

const NODE_PATH_RE = /^\d+\.inputs\.\w+$/;

export function isValidNodePath(path: string): boolean {
  return NODE_PATH_RE.test(path);
}
