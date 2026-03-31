import { describe, it, expect, afterEach } from "bun:test";
import { loadWorkflow, detectOutputNodes } from "cli/utils/fs";
import { unlinkSync, readFileSync } from "fs";

const SampleWorkflow = JSON.parse(readFileSync("sample.json", "utf-8"));

const TMP_PREFIX = "/tmp/cfli-test-";
const createdFiles: string[] = [];

function tmpPath(name: string): string {
  const path = `${TMP_PREFIX}${name}.json`;
  createdFiles.push(path);
  return path;
}

async function writeTmp(name: string, content: string): Promise<string> {
  const path = tmpPath(name);
  await Bun.write(path, content);
  return path;
}

afterEach(() => {
  for (const f of createdFiles) {
    try {
      unlinkSync(f);
    } catch {
      /* noop */
    }
  }
  createdFiles.length = 0;
});

describe("loadWorkflow", () => {
  it("should load sample.json with numeric keys", async () => {
    const result = await loadWorkflow("sample.json");
    expect(result["3"]).toBeDefined();
    expect(result["9"]).toBeDefined();
    expect(result["3"].class_type).toBe("KSampler");
  });

  it("should throw on non-existent file", async () => {
    await expect(loadWorkflow("/tmp/cfli-nonexistent-xyz.json")).rejects.toThrow();
  });

  it("should load a valid single-node workflow", async () => {
    const path = await writeTmp(
      "single-node",
      JSON.stringify({
        "3": { inputs: {}, class_type: "Test", _meta: { title: "T" } }
      })
    );
    const result = await loadWorkflow(path);
    expect(result["3"]).toBeDefined();
    expect(result["3"].class_type).toBe("Test");
  });

  it("should throw on non-numeric key", async () => {
    const path = await writeTmp("bad-key", JSON.stringify({ abc: {} }));
    await expect(loadWorkflow(path)).rejects.toThrow("not a numeric node ID");
  });

  it("should throw on non-JSON content", async () => {
    const path = await writeTmp("bad-json", "not json");
    await expect(loadWorkflow(path)).rejects.toThrow();
  });

  it("should throw on empty object", async () => {
    const path = await writeTmp("empty", JSON.stringify({}));
    await expect(loadWorkflow(path)).rejects.toThrow("no nodes");
  });
});

describe("detectOutputNodes", () => {
  it("should detect SaveImage in sample workflow", () => {
    const nodes = detectOutputNodes(SampleWorkflow as any);
    expect(nodes).toContain("9");
  });

  it("should return empty array when no SaveImage or PreviewImage", () => {
    const workflow = {
      "3": { inputs: {}, class_type: "KSampler", _meta: { title: "K" } },
      "4": { inputs: {}, class_type: "CheckpointLoaderSimple", _meta: { title: "C" } }
    };
    const nodes = detectOutputNodes(workflow as any);
    expect(nodes).toEqual([]);
  });

  it("should detect PreviewImage", () => {
    const workflow = {
      "3": { inputs: {}, class_type: "PreviewImage", _meta: { title: "P" } }
    };
    const nodes = detectOutputNodes(workflow as any);
    expect(nodes).toContain("3");
  });
});
