import { describe, it, expect } from "bun:test";
import { parseArgs } from "cli/args";

describe("parseArgs subcommands", () => {
  it("should default subcommand to 'run'", () => {
    const result = parseArgs(["-f", "workflow.json"]);
    expect(result.subcommand).toBe("run");
  });

  it("should parse 'inspect' subcommand", () => {
    const result = parseArgs(["inspect", "-f", "workflow.json"]);
    expect(result.subcommand).toBe("inspect");
    expect(result.file).toBe("workflow.json");
  });

  it("should parse 'list' subcommand with resource", () => {
    const result = parseArgs(["list", "checkpoints"]);
    expect(result.subcommand).toBe("list");
    expect(result.resource).toBe("checkpoints");
  });

  it("should parse 'queue' subcommand", () => {
    const result = parseArgs(["queue"]);
    expect(result.subcommand).toBe("queue");
  });

  it("should parse 'download' subcommand with promptId", () => {
    const result = parseArgs(["download", "abc-123-def"]);
    expect(result.subcommand).toBe("download");
    expect(result.promptId).toBe("abc-123-def");
  });

  it("should parse 'run' subcommand explicitly", () => {
    const result = parseArgs(["run", "-f", "workflow.json"]);
    expect(result.subcommand).toBe("run");
    expect(result.file).toBe("workflow.json");
  });

  it("should parse subcommand with host flag", () => {
    const result = parseArgs(["list", "loras", "-H", "http://server:8188"]);
    expect(result.subcommand).toBe("list");
    expect(result.resource).toBe("loras");
    expect(result.host).toBe("http://server:8188");
  });

  it("should parse subcommand with --json flag", () => {
    const result = parseArgs(["inspect", "-f", "workflow.json", "-j"]);
    expect(result.subcommand).toBe("inspect");
    expect(result.file).toBe("workflow.json");
    expect(result.json).toBe(true);
  });
});
