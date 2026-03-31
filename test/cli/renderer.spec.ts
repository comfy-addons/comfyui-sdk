import { describe, it, expect } from "bun:test";
import { JsonRenderer } from "cli/renderer/json";
import { QuietRenderer } from "cli/renderer/quiet";
import { TerminalRenderer } from "cli/renderer/terminal";

function captureConsole(): { logs: string[]; errors: string[]; stdout: string[]; restore: () => void } {
  const logs: string[] = [];
  const errors: string[] = [];
  const stdout: string[] = [];
  const origLog = console.log;
  const origError = console.error;
  const origWrite = process.stdout.write.bind(process.stdout);
  console.log = (...args: any[]) => {
    logs.push(args.join(" "));
  };
  console.error = (...args: any[]) => {
    errors.push(args.join(" "));
  };
  process.stdout.write = (data: any, ...rest: any[]) => {
    stdout.push(String(data));
    return origWrite(data, ...rest);
  };
  return {
    logs,
    errors,
    stdout,
    restore: () => {
      console.log = origLog;
      console.error = origError;
      process.stdout.write = origWrite;
    }
  };
}

describe("JsonRenderer", () => {
  it("should output valid JSON from render", () => {
    const { logs, restore } = captureConsole();
    try {
      const renderer = new JsonRenderer();
      const result = {
        status: "completed",
        duration_ms: 1000,
        server: { host: "http://localhost:8188" },
        overrides: {}
      };
      renderer.render(result as any);
      expect(logs).toHaveLength(1);
      const parsed = JSON.parse(logs[0]);
      expect(parsed.status).toBe("completed");
      expect(parsed.duration_ms).toBe(1000);
    } finally {
      restore();
    }
  });

  it("should have all on* methods as no-ops that do not throw", () => {
    const renderer = new JsonRenderer();
    expect(() => renderer.onConnect()).not.toThrow();
    expect(() => renderer.onPending("abc")).not.toThrow();
    expect(() => renderer.onProgress({ value: 1, max: 2, node: "3", prompt_id: "p" })).not.toThrow();
    expect(() => renderer.onOutput("9", {})).not.toThrow();
    expect(() => renderer.onFinished({})).not.toThrow();
    expect(() => renderer.onFailed(new Error("test"))).not.toThrow();
    expect(() => renderer.info("msg")).not.toThrow();
    expect(() => renderer.blank()).not.toThrow();
  });
});

describe("QuietRenderer", () => {
  it("should have all on* methods as no-ops that do not throw", () => {
    const renderer = new QuietRenderer();
    expect(() => renderer.onConnect()).not.toThrow();
    expect(() => renderer.onPending("abc")).not.toThrow();
    expect(() => renderer.onProgress({})).not.toThrow();
    expect(() => renderer.onOutput("9")).not.toThrow();
    expect(() => renderer.onFinished({})).not.toThrow();
    expect(() => renderer.info("msg")).not.toThrow();
    expect(() => renderer.blank()).not.toThrow();
  });

  it("should output error message on onFailed", () => {
    const { errors, restore } = captureConsole();
    try {
      const renderer = new QuietRenderer();
      renderer.onFailed(new Error("test error"));
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("test error");
    } finally {
      restore();
    }
  });
});

describe("TerminalRenderer", () => {
  it("should output Connected and host on onConnect", () => {
    const { logs, restore } = captureConsole();
    try {
      const renderer = new TerminalRenderer("http://server:8188", "workflow.json");
      renderer.onConnect();
      expect(logs).toHaveLength(1);
      expect(logs[0]).toContain("Connected");
      expect(logs[0]).toContain("http://server:8188");
    } finally {
      restore();
    }
  });

  it("should output Node and progress info on onProgress", () => {
    const { stdout, restore } = captureConsole();
    try {
      const renderer = new TerminalRenderer("http://server:8188", "workflow.json");
      renderer.onProgress({ value: 10, max: 20, node: "3", prompt_id: "abc" });
      expect(stdout.length).toBeGreaterThan(0);
      const output = stdout.join(" ");
      expect(output).toContain("Node 3");
      expect(output).toContain("10/20");
    } finally {
      restore();
    }
  });

  it("should output Error on onFailed", () => {
    const { logs, restore } = captureConsole();
    try {
      const renderer = new TerminalRenderer("http://server:8188", "workflow.json");
      renderer.onFailed(new Error("test"));
      expect(logs).toHaveLength(1);
      expect(logs[0]).toContain("Error");
      expect(logs[0]).toContain("test");
    } finally {
      restore();
    }
  });
});
