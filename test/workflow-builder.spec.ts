import { describe, expect, it } from "bun:test";
import { CallWrapper } from "src/call-wrapper";
import { NodeRef, WorkflowBuilder } from "src/workflow-builder";

class TestWorkflowBuilder extends WorkflowBuilder {
  add(classType: string, inputs: Record<string, any>, title?: string) {
    return this.addNode(classType, inputs, title);
  }

  ref<T extends string>(nodeId: string, index: number): NodeRef<T> {
    return this.makeRef<T>(nodeId, index);
  }
}

describe("WorkflowBuilder", () => {
  it("should add nodes and preserve tuple refs", () => {
    const builder = new TestWorkflowBuilder();
    const first = builder.add("CheckpointLoaderSimple", { ckpt_name: "model.safetensors" });
    const modelRef = builder.ref<"MODEL">(first, 0);
    const second = builder.add("KSampler", { model: modelRef }, "Sampler");

    expect(first).toBe("1");
    expect(second).toBe("2");
    expect(modelRef).toEqual(["1", 0]);

    const workflow = builder.workflow;
    expect(workflow["1"].class_type).toBe("CheckpointLoaderSimple");
    expect(workflow["2"]._meta.title).toBe("Sampler");
    expect(workflow["2"].inputs.model).toEqual(["1", 0]);
  });

  it("should return a deep clone for workflow getter", () => {
    const builder = new TestWorkflowBuilder();
    const nodeId = builder.add("SaveImage", { filename_prefix: "out" });
    const copy = builder.workflow;
    copy[nodeId].inputs.filename_prefix = "changed";

    expect(builder.workflow[nodeId].inputs.filename_prefix).toBe("out");
  });

  it("should build PromptBuilder with mapped input and output keys", () => {
    const builder = new TestWorkflowBuilder();
    builder.add("KSampler", { seed: 1 });

    const promptBuilder = builder.build({
      inputs: { seed: "1.inputs.seed" },
      outputs: { images: "1" }
    });

    expect(promptBuilder.mapInputKeys.seed).toBe("1.inputs.seed");
    expect(promptBuilder.mapOutputKeys.images).toBe("1");
    const next = promptBuilder.input("seed", 42);
    expect(next.prompt["1"].inputs.seed).toBe(42);
  });

  it("should infer typed CallWrapper output from OutputNodeId in build config", () => {
    const builder = new WorkflowBuilder().build({
      outputs: {
        images:
          "9" as import("src/workflow-builder").OutputNodeId<{
            images: Array<{ filename: string; subfolder: string; type: string }>;
          }>
      }
    });
    const wrapper = new CallWrapper({} as any, builder);

    const handler: Parameters<typeof wrapper.onFinished>[0] = (data) => {
      const filename: string = data.images.images[0].filename;
      void filename;
    };

    wrapper.onFinished(handler);
    expect(typeof handler).toBe("function");
  });
});
