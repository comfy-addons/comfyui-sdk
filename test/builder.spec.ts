import { PromptBuilder } from "src/prompt-builder";
import { OSType } from "src/types/api";
import Prompt from "../examples/example-txt2img-workflow.json";

import { describe, beforeEach, it, expect } from "bun:test";

describe("PromptBuilder with complex input", () => {
  let promptBuilder: PromptBuilder<"size", "images", typeof Prompt>;

  beforeEach(() => {
    promptBuilder = new PromptBuilder(Prompt, ["size"], ["images"]);
  });

  it("should set and append input nodes correctly", () => {
    promptBuilder.setInputNode("size", "5.inputs.width");
    promptBuilder.appendInputNode("size", "5.inputs.height");

    expect(promptBuilder.mapInputKeys["size"]).toEqual(["5.inputs.width", "5.inputs.height"]);
  });

  it("should set output nodes correctly", () => {
    promptBuilder.setOutputNode("images", "9");

    expect(promptBuilder.mapOutputKeys["images"]).toBe("9");
  });

  it("should update input values correctly", () => {
    promptBuilder.setInputNode("size", "5.inputs.width");
    promptBuilder.appendInputNode("size", "5.inputs.height");

    const newPromptBuilder = promptBuilder.input("size", 1600).clone().input("size", 1500);

    expect(promptBuilder.prompt["5"].inputs.width).toBe(1600);
    expect(newPromptBuilder.prompt["5"].inputs.width).toBe(1500);
    expect(newPromptBuilder.prompt["5"].inputs.height).toBe(1500);
  });

  it("should have correct initial values for complex input structure", () => {
    expect(promptBuilder.prompt["3"].inputs.seed).toBe(509648683700218);
    expect(promptBuilder.prompt["4"].inputs.ckpt_name).toBe("SDXL/dreamshaperXL_v2TurboDpmppSDE.safetensors");
    expect(promptBuilder.prompt["6"].inputs.text).toBe("beautiful scenery nature glass bottle landscape");
    expect(promptBuilder.prompt["7"].inputs.text).toBe("text, watermark");
    expect(promptBuilder.prompt["8"].inputs.samples).toEqual(["3", 0]);
    expect(promptBuilder.prompt["9"].inputs.filename_prefix).toBe("ComfyUI");
    expect(promptBuilder.prompt["10"].inputs.model_name).toBe("4x-ClearRealityV1.pth");
    expect(promptBuilder.prompt["11"].inputs.upscale_model).toEqual(["10", 0]);
    expect(promptBuilder.prompt["12"].inputs.filename_prefix).toBe("ComfyUI");
  });

  it("should clone the prompt builder correctly", () => {
    const clonedBuilder = promptBuilder.clone();

    expect(clonedBuilder).not.toBe(promptBuilder);
    expect(clonedBuilder.prompt).toEqual(promptBuilder.prompt);
    expect(clonedBuilder.mapInputKeys).toEqual(promptBuilder.mapInputKeys);
    expect(clonedBuilder.mapOutputKeys).toEqual(promptBuilder.mapOutputKeys);
  });

  it("should get the workflow correctly", () => {
    const workflow = promptBuilder.workflow;
    expect(workflow).toEqual(Prompt);
  });

  it("should return the same instance when calling caller", () => {
    const callerInstance = promptBuilder.caller;
    expect(callerInstance).toBe(promptBuilder);
  });
});

describe("PromptBuilder bypass and reinstate", () => {
  let builder: PromptBuilder<"positive", "images", typeof Prompt>;

  beforeEach(() => {
    builder = new PromptBuilder(Prompt, ["positive"], ["images"])
      .setInputNode("positive", "6.inputs.text")
      .setOutputNode("images", "9");
  });

  it("should mark a single node for bypass", () => {
    const bypassed = builder.bypass("10");
    expect(bypassed.bypassNodes).toContain("10");
    expect(builder.bypassNodes).not.toContain("10");
  });

  it("should mark multiple nodes for bypass", () => {
    const bypassed = builder.bypass(["10", "11", "12"]);
    expect(bypassed.bypassNodes).toEqual(["10", "11", "12"]);
  });

  it("should not modify original builder when bypassing", () => {
    builder.bypass("10");
    expect(builder.bypassNodes).toEqual([]);
  });

  it("should reinstate a bypassed node", () => {
    const bypassed = builder.bypass(["10", "11"]);
    const reinstated = bypassed.reinstate("10");
    expect(reinstated.bypassNodes).toEqual(["11"]);
  });

  it("should reinstate multiple nodes", () => {
    const bypassed = builder.bypass(["10", "11", "12"]);
    const reinstated = bypassed.reinstate(["10", "12"]);
    expect(reinstated.bypassNodes).toEqual(["11"]);
  });
});

describe("PromptBuilder inputRaw", () => {
  let builder: PromptBuilder<"positive", "images", typeof Prompt>;

  beforeEach(() => {
    builder = new PromptBuilder(Prompt, ["positive"], ["images"])
      .setInputNode("positive", "6.inputs.text")
      .setOutputNode("images", "9");
  });

  it("should set a raw value at a dot-notation path", () => {
    const result = builder.inputRaw("3.inputs.seed", 42);
    expect(result.prompt["3"].inputs.seed).toBe(42);
  });

  it("should create intermediate objects for nested paths", () => {
    const result = builder.inputRaw("3.inputs.new_field.sub", "hello");
    expect((result.prompt["3"].inputs as any).new_field.sub).toBe("hello");
  });

  it("should throw on __proto__ key", () => {
    expect(() => builder.inputRaw("__proto__", "evil")).toThrow("Invalid key");
  });

  it("should throw on constructor key", () => {
    expect(() => builder.inputRaw("constructor", "evil")).toThrow("Invalid key");
  });
});

describe("PromptBuilder input with encodeOs", () => {
  let builder: PromptBuilder<"checkpoint", "images", typeof Prompt>;

  beforeEach(() => {
    builder = new PromptBuilder(Prompt, ["checkpoint"], ["images"])
      .setInputNode("checkpoint", "4.inputs.ckpt_name")
      .setOutputNode("images", "9");
  });

  it("should encode path as NT when OSType.NT is specified", () => {
    const result = builder.input("checkpoint", "models/SDXL/model.safetensors", OSType.NT);
    expect(result.prompt["4"].inputs.ckpt_name).toBe("models\\SDXL\\model.safetensors");
  });

  it("should encode path as POSIX when OSType.POSIX is specified", () => {
    const result = builder.input("checkpoint", "models\\SDXL\\model.safetensors", OSType.POSIX);
    expect(result.prompt["4"].inputs.ckpt_name).toBe("models/SDXL/model.safetensors");
  });

  it("should not modify path when no encodeOs is specified", () => {
    const result = builder.input("checkpoint", "models/SDXL/model.safetensors");
    expect(result.prompt["4"].inputs.ckpt_name).toBe("models/SDXL/model.safetensors");
  });
});

describe("PromptBuilder setRawInputNode / setRawOutputNode", () => {
  let builder: PromptBuilder<"cfg", "images", typeof Prompt>;

  beforeEach(() => {
    builder = new PromptBuilder(Prompt, ["cfg"], ["images"]).setOutputNode("images", "9");
  });

  it("should set raw input node and allow setting value via input()", () => {
    const result = builder.setRawInputNode("cfg", "3.inputs.cfg").input("cfg", 5);
    expect(result.prompt["3"].inputs.cfg).toBe(5);
  });

  it("should set raw output node", () => {
    const result = builder.setRawOutputNode("images", "12");
    expect(result.mapOutputKeys["images"]).toBe("12");
  });

  it("should append raw input node to existing mapping", () => {
    const result = builder
      .setRawInputNode("cfg", "3.inputs.cfg")
      .appendRawInputNode("cfg", "3.inputs.denoise")
      .input("cfg", 3.5);
    expect(result.prompt["3"].inputs.cfg).toBe(3.5);
    expect(result.prompt["3"].inputs.denoise).toBe(3.5);
  });
});

describe("PromptBuilder input edge cases", () => {
  it("should throw when setting a value for an unmapped key", () => {
    const builder = new PromptBuilder(Prompt, ["nonexistent"] as any, []);
    expect(() => builder.input("nonexistent", "value")).toThrow("Key nonexistent not found");
  });

  it("should no-op when value is undefined", () => {
    const builder = new PromptBuilder(Prompt, ["positive"], ["images"]).setInputNode("positive", "6.inputs.text");
    const originalText = builder.prompt["6"].inputs.text;
    const result = builder.input("positive", undefined as any);
    expect(result.prompt["6"].inputs.text).toBe(originalText);
  });
});
