import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { buildInspectData } from "cli/commands/inspect";
import { writeFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";

const FIXTURE_DIR = join(import.meta.dir, ".fixtures");

const SAMPLE_WORKFLOW = {
  "3": {
    class_type: "KSampler",
    inputs: {
      seed: 156680208700286,
      steps: 20,
      cfg: 8,
      sampler_name: "euler",
      scheduler: "normal",
      denoise: 1,
      model: ["4", 0],
      positive: ["6", 0],
      negative: ["7", 0],
      latent_image: ["5", 0]
    }
  },
  "4": {
    class_type: "CheckpointLoaderSimple",
    inputs: {
      ckpt_name: "v1-5-pruned-emaonly.ckpt"
    }
  },
  "5": {
    class_type: "EmptyLatentImage",
    inputs: {
      width: 512,
      height: 512,
      batch_size: 1
    }
  },
  "6": {
    class_type: "CLIPTextEncode",
    inputs: {
      text: "hello",
      clip: ["4", 1]
    }
  },
  "9": {
    class_type: "SaveImage",
    inputs: {
      images: ["8", 0],
      filename_prefix: "ComfyUI"
    }
  }
};

describe("buildInspectData", () => {
  beforeEach(() => {
    mkdirSync(FIXTURE_DIR, { recursive: true });
    writeFileSync(join(FIXTURE_DIR, "inspect.json"), JSON.stringify(SAMPLE_WORKFLOW));
  });

  afterEach(() => {
    rmSync(FIXTURE_DIR, { recursive: true, force: true });
  });

  it("should parse workflow and return inspect data", async () => {
    const result = await buildInspectData(join(FIXTURE_DIR, "inspect.json"));
    expect(result.file).toContain("inspect.json");
    expect(result.nodeCount).toBe(5);
    expect(result.nodes).toHaveLength(5);
  });

  it("should detect SaveImage as output node", async () => {
    const result = await buildInspectData(join(FIXTURE_DIR, "inspect.json"));
    expect(result.outputNodeIds).toEqual(["9"]);
    expect(result.nodes.find((n) => n.id === "9")?.isOutput).toBe(true);
  });

  it("should list only text/primitive inputs (not node links)", async () => {
    const result = await buildInspectData(join(FIXTURE_DIR, "inspect.json"));
    const ksampler = result.nodes.find((n) => n.id === "3")!;
    expect(ksampler.inputs).toContain("seed");
    expect(ksampler.inputs).toContain("steps");
    expect(ksampler.inputs).toContain("cfg");
    expect(ksampler.inputs).toContain("sampler_name");
    expect(ksampler.inputs).toContain("scheduler");
    expect(ksampler.inputs).toContain("denoise");
    expect(ksampler.inputs).not.toContain("model");
    expect(ksampler.inputs).not.toContain("positive");
    expect(ksampler.inputs).not.toContain("negative");
    expect(ksampler.inputs).not.toContain("latent_image");
  });

  it("should build available paths", async () => {
    const result = await buildInspectData(join(FIXTURE_DIR, "inspect.json"));
    expect(result.availablePaths).toContain("3.inputs.seed");
    expect(result.availablePaths).toContain("4.inputs.ckpt_name");
    expect(result.availablePaths).toContain("6.inputs.text");
    expect(result.availablePaths).toContain("9.inputs.filename_prefix");
  });

  it("should sort nodes by numeric ID", async () => {
    const result = await buildInspectData(join(FIXTURE_DIR, "inspect.json"));
    expect(result.nodes[0].id).toBe("3");
    expect(result.nodes[1].id).toBe("4");
    expect(result.nodes[4].id).toBe("9");
  });

  it("should throw on invalid workflow file", async () => {
    expect(buildInspectData(join(FIXTURE_DIR, "nonexistent.json"))).rejects.toThrow();
  });
});
