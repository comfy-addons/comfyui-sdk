import { describe, it, expect } from "bun:test";
import { parseOverride, coerceValue, isValidNodePath } from "cli/utils/value-parser";

describe("parseOverride", () => {
  it('should parse "key=value"', () => {
    const result = parseOverride("key=value");
    expect(result).toEqual({ key: "key", value: "value" });
  });

  it('should parse "key=complex=value" splitting on first =', () => {
    const result = parseOverride("key=complex=value");
    expect(result).toEqual({ key: "key", value: "complex=value" });
  });

  it('should throw on "noequals"', () => {
    expect(() => parseOverride("noequals")).toThrow('must contain "="');
  });

  it('should throw on "=value" (empty key)', () => {
    expect(() => parseOverride("=value")).toThrow("key cannot be empty");
  });

  it("should throw on empty string", () => {
    expect(() => parseOverride("")).toThrow('must contain "="');
  });
});

describe("coerceValue", () => {
  it('should coerce "true" to boolean true', () => {
    expect(coerceValue("true")).toBe(true);
  });

  it('should coerce "false" to boolean false', () => {
    expect(coerceValue("false")).toBe(false);
  });

  it('should coerce "42" to number 42', () => {
    expect(coerceValue("42")).toBe(42);
  });

  it('should coerce "0" to number 0', () => {
    expect(coerceValue("0")).toBe(0);
  });

  it('should coerce "1.5" to number 1.5', () => {
    expect(coerceValue("1.5")).toBe(1.5);
  });

  it('should keep "007" as string (leading zero)', () => {
    expect(coerceValue("007")).toBe("007");
  });

  it('should keep "hello" as string', () => {
    expect(coerceValue("hello")).toBe("hello");
  });

  it('should keep "SDXL/model.safetensors" as string', () => {
    expect(coerceValue("SDXL/model.safetensors")).toBe("SDXL/model.safetensors");
  });

  it('should parse "[\\"a\\",\\"b\\"]" to array', () => {
    expect(coerceValue('["a","b"]')).toEqual(["a", "b"]);
  });

  it('should parse "[\\"4\\", 0]" to tuple', () => {
    expect(coerceValue('["4", 0]')).toEqual(["4", 0]);
  });
});

describe("isValidNodePath", () => {
  it('should accept "4.inputs.ckpt_name"', () => {
    expect(isValidNodePath("4.inputs.ckpt_name")).toBe(true);
  });

  it('should accept "3.inputs.seed"', () => {
    expect(isValidNodePath("3.inputs.seed")).toBe(true);
  });

  it('should accept "6.inputs.text"', () => {
    expect(isValidNodePath("6.inputs.text")).toBe(true);
  });

  it('should reject "inputs.ckpt_name" (no node ID)', () => {
    expect(isValidNodePath("inputs.ckpt_name")).toBe(false);
  });

  it('should reject "4.ckpt_name" (missing "inputs")', () => {
    expect(isValidNodePath("4.ckpt_name")).toBe(false);
  });

  it('should reject "4.inputs." (empty field)', () => {
    expect(isValidNodePath("4.inputs.")).toBe(false);
  });

  it('should reject "4.inputs.ckpt-name" (hyphen not \\w)', () => {
    expect(isValidNodePath("4.inputs.ckpt-name")).toBe(false);
  });
});
