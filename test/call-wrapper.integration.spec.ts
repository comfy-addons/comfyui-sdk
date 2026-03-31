import { ComfyApi } from "../src/client";
import { PromptBuilder } from "../src/prompt-builder";
import { CallWrapper } from "../src/call-wrapper";
import { seed } from "../src/tools";
import { TSamplerName, TSchedulerName } from "../src/types/sampler";
import SampleWorkflow from "../sample.json";
import { getTestHost, createTestClient, waitForClient } from "./fixtures";

import { describe, beforeAll, afterAll, it, expect } from "bun:test";

describe.skipIf(!getTestHost())("CallWrapper Integration", () => {
  let api: ComfyApi;
  let checkpoint: string;

  const INPUT_KEYS = [
    "positive",
    "negative",
    "checkpoint",
    "seed",
    "step",
    "cfg",
    "sampler",
    "scheduler",
    "width",
    "height",
    "batch"
  ] as const;

  const OUTPUT_KEYS = ["images"] as const;

  const buildWorkflow = (checkpointName: string, positivePrompt: string) => {
    return new PromptBuilder(SampleWorkflow, [...INPUT_KEYS], [...OUTPUT_KEYS])
      .setInputNode("checkpoint", "4.inputs.ckpt_name")
      .setInputNode("seed", "3.inputs.seed")
      .setInputNode("negative", "7.inputs.text")
      .setInputNode("positive", "6.inputs.text")
      .setInputNode("cfg", "3.inputs.cfg")
      .setInputNode("sampler", "3.inputs.sampler_name")
      .setInputNode("scheduler", "3.inputs.scheduler")
      .setInputNode("step", "3.inputs.steps")
      .setInputNode("width", "5.inputs.width")
      .setInputNode("height", "5.inputs.height")
      .setInputNode("batch", "5.inputs.batch_size")
      .setOutputNode("images", "9")
      .input("checkpoint", checkpointName)
      .input("seed", seed())
      .input("step", 6)
      .input("cfg", 1)
      .input<TSamplerName>("sampler", "euler")
      .input<TSchedulerName>("scheduler", "normal")
      .input("width", 512)
      .input("height", 512)
      .input("batch", 1)
      .input("positive", positivePrompt)
      .input("negative", "text, watermark, low quality");
  };

  beforeAll(async () => {
    api = createTestClient();
    await waitForClient(api);
    const checkpoints = await api.getCheckpoints();
    checkpoint = checkpoints[0];
  });

  afterAll(() => {
    api.destroy();
  });

  it("should execute a full workflow and produce output images", async () => {
    const workflow = buildWorkflow(checkpoint, "a beautiful sunset over mountains, high quality");

    const result = await new Promise<any>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Workflow timeout")), 120_000);

      new CallWrapper(api, workflow)
        .onPending((promptId) => expect(promptId).toBeDefined())
        .onStart((promptId) => expect(promptId).toBeDefined())
        .onProgress((info) => {
          expect(info.node).toBeDefined();
          expect(typeof info.value).toBe("number");
          expect(typeof info.max).toBe("number");
        })
        .onFinished((data, promptId) => {
          clearTimeout(timeout);
          expect(promptId).toBeDefined();
          expect(data.images).toBeDefined();
          expect(data.images.images).toBeDefined();
          expect(data.images.images.length).toBeGreaterThan(0);
          resolve(data);
        })
        .onFailed((err) => {
          clearTimeout(timeout);
          reject(new Error(`Workflow failed: ${err.message}`));
        })
        .run();
    });

    expect(result).toBeDefined();
    expect(result.images.images[0].filename).toBeDefined();
  }, 120_000);

  it("should receive all event callbacks in order", async () => {
    const workflow = buildWorkflow(checkpoint, "a cute dog, high quality");

    const events: string[] = [];

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timeout")), 120_000);

      new CallWrapper(api, workflow)
        .onPending(() => events.push("pending"))
        .onStart(() => events.push("started"))
        .onProgress(() => {
          if (!events.includes("progress")) events.push("progress");
        })
        .onFinished(() => {
          clearTimeout(timeout);
          events.push("finished");
          expect(events[0]).toBe("pending");
          expect(events.includes("started")).toBe(true);
          expect(events.includes("progress")).toBe(true);
          expect(events[events.length - 1]).toBe("finished");
          resolve();
        })
        .onFailed((err) => {
          clearTimeout(timeout);
          reject(new Error(`Failed: ${err.message}`));
        })
        .run();
    });
  }, 120_000);

  it("should fail with invalid checkpoint", async () => {
    const workflow = buildWorkflow("nonexistent_checkpoint.safetensors", "test");

    await expect(
      new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Timeout")), 30_000);

        new CallWrapper(api, workflow)
          .onFinished(() => {
            clearTimeout(timeout);
            reject(new Error("Should not succeed with invalid checkpoint"));
          })
          .onFailed((err) => {
            clearTimeout(timeout);
            expect(err).toBeDefined();
            expect(err.message).toBeDefined();
            resolve();
          })
          .run();
      })
    ).resolves.toBeUndefined();
  }, 30_000);

  it("should generate valid image URLs from output", async () => {
    const workflow = buildWorkflow(checkpoint, "ocean waves, 4k");

    const result = await new Promise<any>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timeout")), 120_000);

      new CallWrapper(api, workflow)
        .onFinished((data) => {
          clearTimeout(timeout);
          resolve(data);
        })
        .onFailed((err) => {
          clearTimeout(timeout);
          reject(new Error(`Failed: ${err.message}`));
        })
        .run();
    });

    const imageUrl = api.getPathImage(result.images.images[0]);
    expect(imageUrl).toContain(getTestHost());
    expect(imageUrl).toContain("filename=");
    expect(imageUrl).toContain("type=output");
  }, 120_000);
});
