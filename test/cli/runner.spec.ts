import { describe, it, expect } from "bun:test";
import { buildResultOverrides, runWorkflow, type RunConfig, type RunCallbacks } from "cli/runner";
import { getTestHost } from "../fixtures";
import { resolve } from "path";

describe("RunConfig type", () => {
  it("should be exportable as a type", () => {
    const config: RunConfig = {
      file: "test.json",
      inputs: [],
      host: "http://localhost:8188",
      timeout: 120000,
      output: "./output",
      download: false,
      noDownload: false
    };
    expect(config.file).toBe("test.json");
    expect(config.inputs).toEqual([]);
  });
});

describe("buildResultOverrides", () => {
  it("should return empty object for empty array", () => {
    expect(buildResultOverrides([])).toEqual({});
  });

  it("should build a single-entry override", () => {
    const result = buildResultOverrides([{ key: "a.b", value: "1" }]);
    expect(result).toEqual({ "a.b": "1" });
  });

  it("should build multiple-entry override", () => {
    const inputs = [
      { key: "3.inputs.seed", value: "42" },
      { key: "4.inputs.ckpt_name", value: "model.safetensors" },
      { key: "5.inputs.width", value: "1024" }
    ];
    const result = buildResultOverrides(inputs);
    expect(result["3.inputs.seed"]).toBe("42");
    expect(result["4.inputs.ckpt_name"]).toBe("model.safetensors");
    expect(result["5.inputs.width"]).toBe("1024");
  });
});

describe("runWorkflow unit", () => {
  it("should throw on invalid node path", async () => {
    const sampleFile = resolve("sample.json");
    const config: RunConfig = {
      file: sampleFile,
      inputs: [{ key: "99.inputs.foo", value: "bar" }],
      host: "http://localhost:8188",
      timeout: 5000,
      output: "./output",
      download: false,
      noDownload: false
    };
    const noopCallbacks: RunCallbacks = {
      onConnect: () => {},
      onPending: () => {},
      onProgress: () => {},
      onOutput: () => {},
      onFinished: () => {},
      onFailed: () => {},
      info: () => {},
      blank: () => {}
    };
    await expect(runWorkflow(config, noopCallbacks)).rejects.toThrow('Node "99" not found');
  });

  it("should throw on missing file", async () => {
    const config: RunConfig = {
      file: "/tmp/cfli-nonexistent-test-workflow.json",
      inputs: [],
      host: "http://localhost:8188",
      timeout: 5000,
      output: "./output",
      download: false,
      noDownload: false
    };
    const noopCallbacks: RunCallbacks = {
      onConnect: () => {},
      onPending: () => {},
      onProgress: () => {},
      onOutput: () => {},
      onFinished: () => {},
      onFailed: () => {},
      info: () => {},
      blank: () => {}
    };
    await expect(runWorkflow(config, noopCallbacks)).rejects.toThrow();
  });
});

describe.skipIf(!getTestHost())("runWorkflow integration", () => {
  it("should execute sample workflow with overrides", async () => {
    const sampleFile = resolve("sample.json");
    const config: RunConfig = {
      file: sampleFile,
      inputs: [
        { key: "3.inputs.seed", value: "42" },
        { key: "3.inputs.steps", value: "1" }
      ],
      host: getTestHost(),
      timeout: 120_000,
      output: "./output",
      download: false,
      noDownload: true
    };
    const events: string[] = [];
    const callbacks: RunCallbacks = {
      onConnect: () => {
        events.push("connect");
      },
      onPending: () => {
        events.push("pending");
      },
      onProgress: () => {},
      onOutput: () => {
        events.push("output");
      },
      onFinished: () => {
        events.push("finished");
      },
      onFailed: () => {
        events.push("failed");
      },
      info: () => {},
      blank: () => {}
    };
    const result = await runWorkflow(config, callbacks);
    expect(result).toBeDefined();
    expect(events).toContain("connect");
  }, 120_000);
});
