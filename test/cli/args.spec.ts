import { describe, it, expect } from "bun:test";
import { parseArgs, USAGE_TEXT } from "cli/args";

describe("USAGE_TEXT", () => {
  it("should be a non-empty string", () => {
    expect(typeof USAGE_TEXT).toBe("string");
    expect(USAGE_TEXT.length).toBeGreaterThan(0);
  });
});

describe("parseArgs", () => {
  it("should return defaults for empty args", () => {
    const result = parseArgs([]);
    expect(result.file).toBeUndefined();
    expect(result.inputs).toEqual([]);
    expect(result.timeout).toBe(120000);
    expect(result.output).toBe("./output");
    expect(result.json).toBe(false);
    expect(result.quiet).toBe(false);
    expect(result.download).toBe(false);
    expect(result.noDownload).toBe(false);
    expect(result.version).toBe(false);
    expect(result.help).toBe(false);
    expect(result.watch).toBe(false);
    expect(result.interactive).toBe(false);
    expect(result.host).toBe(process.env.COMFYUI_HOST || "http://localhost:8188");
  });

  it("should set file with -f", () => {
    const result = parseArgs(["-f", "workflow.json"]);
    expect(result.file).toBe("workflow.json");
  });

  it("should push one input with -i", () => {
    const result = parseArgs(["-i", "3.inputs.seed=42"]);
    expect(result.inputs).toHaveLength(1);
    expect(result.inputs[0]).toEqual({ key: "3.inputs.seed", value: "42" });
  });

  it("should push multiple inputs with repeated -i", () => {
    const result = parseArgs(["-i", "3.inputs.seed=42", "-i", "4.inputs.ckpt_name=model.safetensors"]);
    expect(result.inputs).toHaveLength(2);
    expect(result.inputs[0].key).toBe("3.inputs.seed");
    expect(result.inputs[1].key).toBe("4.inputs.ckpt_name");
  });

  it("should push inputs with -p same as -i", () => {
    const result = parseArgs(["-p", "3.inputs.seed=42"]);
    expect(result.inputs).toHaveLength(1);
    expect(result.inputs[0]).toEqual({ key: "3.inputs.seed", value: "42" });
  });

  it("should set host with -H", () => {
    const result = parseArgs(["-H", "http://server:8188"]);
    expect(result.host).toBe("http://server:8188");
  });

  it("should set timeout with -t", () => {
    const result = parseArgs(["-t", "60000"]);
    expect(result.timeout).toBe(60000);
  });

  it("should set json with -j", () => {
    const result = parseArgs(["-j"]);
    expect(result.json).toBe(true);
  });

  it("should set quiet with -q", () => {
    const result = parseArgs(["-q"]);
    expect(result.quiet).toBe(true);
  });

  it("should set download with -d", () => {
    const result = parseArgs(["-d"]);
    expect(result.download).toBe(true);
  });

  it("should set noDownload with --no-download", () => {
    const result = parseArgs(["--no-download"]);
    expect(result.noDownload).toBe(true);
  });

  it("should set token with --token", () => {
    const result = parseArgs(["--token", "abc"]);
    expect(result.token).toBe("abc");
  });

  it("should set outputNodes with --output-nodes", () => {
    const result = parseArgs(["--output-nodes", "9,10"]);
    expect(result.outputNodes).toEqual(["9", "10"]);
  });

  it("should set completions with --completions bash", () => {
    const result = parseArgs(["--completions", "bash"]);
    expect(result.completions).toBe("bash");
  });

  it("should throw on --completions invalid", () => {
    expect(() => parseArgs(["--completions", "invalid"])).toThrow("Invalid completions shell");
  });

  it("should throw on unknown flag", () => {
    expect(() => parseArgs(["--unknown"])).toThrow("Unknown flag");
  });

  it("should throw on missing value for -f", () => {
    expect(() => parseArgs(["-f"])).toThrow("Missing value for -f");
  });

  it("should set version with -v", () => {
    const result = parseArgs(["-v"]);
    expect(result.version).toBe(true);
  });

  it("should set help with -h", () => {
    const result = parseArgs(["-h"]);
    expect(result.help).toBe(true);
  });

  it('should throw on -i "bad" (no =)', () => {
    expect(() => parseArgs(["-i", "bad"])).toThrow("Invalid input format");
  });
});
