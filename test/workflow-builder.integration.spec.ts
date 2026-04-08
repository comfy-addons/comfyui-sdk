import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, stat, symlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { pathToFileURL } from "url";
import { ComfyApi } from "../src/client";
import { CallWrapper } from "../src/call-wrapper";
import { getTestHost, createTestClient, waitForClient } from "./fixtures";
import { codegenWorkflowBuilder } from "../cli/commands/codegen";

describe.skipIf(!getTestHost())("WorkflowBuilder Generated Integration", () => {
  let api: ComfyApi;
  let generatedDir = "";
  let generatedFile = "";
  let GeneratedWorkflowBuilder: any;
  let checkpoint = "";
  let samplerName = "euler";
  let schedulerName = "normal";

  beforeAll(async () => {
    api = createTestClient();
    await waitForClient(api);

    const checkpoints = await api.getCheckpoints();
    expect(checkpoints.length).toBeGreaterThan(0);
    checkpoint = checkpoints[0];

    const ksamplerDef = await api.getNodeDefs("KSampler");
    const samplerValues = Array.isArray(ksamplerDef?.KSampler?.input?.required?.sampler_name?.[0])
      ? (ksamplerDef?.KSampler?.input?.required?.sampler_name?.[0] as string[])
      : [];
    const schedulerValues = Array.isArray(ksamplerDef?.KSampler?.input?.required?.scheduler?.[0])
      ? (ksamplerDef?.KSampler?.input?.required?.scheduler?.[0] as string[])
      : [];

    samplerName = samplerValues.includes("euler") ? "euler" : (samplerValues[0] ?? "euler");
    schedulerName = schedulerValues.includes("normal") ? "normal" : (schedulerValues[0] ?? "normal");

    generatedDir = await mkdtemp(join(tmpdir(), "comfyui-sdk-codegen-"));
    generatedFile = join(generatedDir, "nodes.ts");
    await codegenWorkflowBuilder(getTestHost(), generatedFile, false);
    const linkParent = join(generatedDir, "node_modules", "@saintno");
    await mkdir(linkParent, { recursive: true });
    await symlink(process.cwd(), join(linkParent, "comfyui-sdk"), "dir");

    const generatedModule = await import(pathToFileURL(generatedFile).href);
    GeneratedWorkflowBuilder = generatedModule.WorkflowBuilder;
  });

  afterAll(async () => {
    api.destroy();
    if (generatedDir) {
      await rm(generatedDir, { recursive: true, force: true });
    }
  });

  it("should generate typed workflow file from real server", async () => {
    expect(generatedFile.endsWith("nodes.ts")).toBe(true);
    await expect(stat(generatedFile)).resolves.toBeDefined();
    expect(typeof GeneratedWorkflowBuilder).toBe("function");
  });

  it("should build and run workflow from generated WorkflowBuilder", async () => {
    const wf = new GeneratedWorkflowBuilder();
    const ckpt = wf.CheckpointLoaderSimple({ ckpt_name: checkpoint });
    const pos = wf.CLIPTextEncode({ text: "landscape", clip: ckpt.CLIP });
    const neg = wf.CLIPTextEncode({ text: "ugly", clip: ckpt.CLIP });
    const lat = wf.EmptyLatentImage({ width: 512, height: 512, batch_size: 1 });
    const smp = wf.KSampler({
      model: ckpt.MODEL,
      positive: pos.CONDITIONING,
      negative: neg.CONDITIONING,
      latent_image: lat.LATENT,
      seed: 42,
      steps: 20,
      cfg: 7,
      sampler_name: samplerName,
      scheduler: schedulerName,
      denoise: 1
    });
    const vae = wf.VAEDecode({ samples: smp.LATENT, vae: ckpt.VAE });
    const save = wf.SaveImage({ images: vae.IMAGE, filename_prefix: "output" });

    const builder = wf.build({
      inputs: { seed: "5.inputs.seed" },
      outputs: { images: save.__id }
    });

    const result = await new Promise<any>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Workflow timeout")), 120_000);

      new CallWrapper(api, builder)
        .onFinished((data) => {
          clearTimeout(timeout);
          resolve(data);
        })
        .onFailed((err) => {
          clearTimeout(timeout);
          reject(new Error(`Workflow failed: ${err.message}`));
        })
        .run();
    });

    expect(result.images).toBeDefined();
    expect(Array.isArray(result.images.images)).toBe(true);
    expect(result.images.images.length).toBeGreaterThan(0);
    expect(result.images.images[0].filename).toBeDefined();
  }, 120_000);
});
