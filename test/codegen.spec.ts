import { describe, expect, it } from "bun:test";
import { generateWorkflowCode } from "src/codegen";
import { NodeDefsResponse } from "src/types/api";

const MOCK_NODE_DEFS: NodeDefsResponse = {
  KSampler: {
    input: {
      required: {
        model: ["MODEL", { tooltip: "Model" }],
        seed: ["INT", { default: 0, min: 0, max: 999999999 }],
        steps: ["INT", { default: 20, min: 1, max: 200 }],
        cfg: ["FLOAT", { default: 7, min: 0, max: 30 }],
        sampler_name: [["euler", "heun"], { tooltip: "Sampler" }],
        scheduler: [["normal", "karras"], { tooltip: "Scheduler" }],
        positive: ["CONDITIONING", { tooltip: "Positive conditioning" }],
        negative: ["CONDITIONING", { tooltip: "Negative conditioning" }],
        latent_image: ["LATENT", { tooltip: "Latent image" }]
      },
      optional: {
        denoise: ["FLOAT", { default: 1, min: 0, max: 1 }]
      },
      hidden: {
        prompt: "PROMPT"
      }
    },
    input_order: {
      required: ["model", "seed", "steps", "cfg", "sampler_name", "scheduler", "positive", "negative", "latent_image"],
      optional: ["denoise"],
      hidden: ["prompt"]
    },
    output: ["LATENT"],
    output_is_list: [false],
    output_name: ["LATENT"],
    name: "KSampler",
    display_name: "KSampler",
    description: "",
    category: "sampling",
    python_module: "",
    output_node: false,
    output_tooltips: [""]
  },
  SaveImage: {
    input: {
      required: {
        images: ["IMAGE", { tooltip: "Images" }],
        filename_prefix: ["STRING", { default: "ComfyUI" }]
      },
      hidden: {}
    },
    input_order: {
      required: ["images", "filename_prefix"],
      hidden: []
    },
    output: [],
    output_is_list: [],
    output_name: [],
    name: "SaveImage",
    display_name: "SaveImage",
    description: "",
    category: "image",
    python_module: "",
    output_node: true,
    output_tooltips: []
  },
  UnionOutputNode: {
    input: {
      required: {
        value: ["INT", { default: 1, min: 0, max: 10 }]
      },
      hidden: {}
    },
    input_order: {
      required: ["value"],
      hidden: []
    },
    output: [["TYPE_A", "TYPE_B"]] as any,
    output_is_list: [false],
    output_name: ["VALUE"],
    name: "UnionOutputNode",
    display_name: "UnionOutputNode",
    description: "",
    category: "custom",
    python_module: "",
    output_node: false,
    output_tooltips: [""]
  },
  "CR Multi-ControlNet Stack": {
    input: {
      required: {
        mode: [["off", "on"], { tooltip: "Mode" }],
        any_input: ["*", { tooltip: "Any" }]
      },
      hidden: {}
    },
    input_order: {
      required: ["mode", "any_input"],
      hidden: []
    },
    output: ["CONTROL_NET"],
    output_is_list: [false],
    output_name: ["CONTROL NET"],
    name: "CR Multi-ControlNet Stack",
    display_name: "CR Multi-ControlNet Stack",
    description: "",
    category: "custom",
    python_module: "",
    output_node: false,
    output_tooltips: [""]
  },
  "CR-Multi ControlNet Stack": {
    input: {
      required: {
        image: ["IMAGE", { tooltip: "Image" }]
      },
      hidden: {}
    },
    input_order: {
      required: ["image"],
      hidden: []
    },
    output: ["IMAGE"],
    output_is_list: [false],
    output_name: ["IMAGE"],
    name: "CR-Multi ControlNet Stack",
    display_name: "CR-Multi ControlNet Stack",
    description: "",
    category: "custom",
    python_module: "",
    output_node: false,
    output_tooltips: [""]
  }
};

describe("generateWorkflowCode", () => {
  it("should map ComfyUI node defs into typed WorkflowBuilder methods", () => {
    const code = generateWorkflowCode(MOCK_NODE_DEFS);

    expect(code).toContain('import { WorkflowBuilder as BaseWorkflowBuilder, NodeRef } from "@saintno/comfyui-sdk";');
    expect(code).toContain("export interface KSamplerInputs {");
    expect(code).toContain("  model: NodeRef<\"MODEL\">;");
    expect(code).toContain("  seed: number;");
    expect(code).toContain("  sampler_name: \"euler\" | \"heun\";");
    expect(code).toContain("  scheduler: \"normal\" | \"karras\";");
    expect(code).toContain("  denoise?: number;");
    expect(code).toContain("export interface KSamplerInputPaths {");
    expect(code).toContain("  seed: string;");
    expect(code).toContain("export interface KSamplerOutputs {");
    expect(code).toContain("  LATENT: NodeRef<\"LATENT\">;");
    expect(code).toContain(
      "KSampler(inputs: KSamplerInputs): KSamplerOutputs & { __id: string; inputs: KSamplerInputPaths }"
    );
    expect(code).toContain("seed: `${id}.inputs.seed`,");
    expect(code).toContain("inputs: inputPaths");
    expect(code).toContain('  VALUE: NodeRef<"TYPE_A" | "TYPE_B">;');
    expect(code).not.toContain("prompt:");
  });

  it("should sanitize special node names and append suffixes for duplicates", () => {
    const code = generateWorkflowCode(MOCK_NODE_DEFS);

    expect(code).toContain('/** Node: "CR Multi-ControlNet Stack" */');
    expect(code).toContain('/** Node: "CR-Multi ControlNet Stack" */');
    expect(code).toContain(
      "CRMultiControlNetStack(inputs: CRMultiControlNetStackInputs): CRMultiControlNetStackOutputs & { __id: string; inputs: CRMultiControlNetStackInputPaths }"
    );
    expect(code).toContain(
      "CRMultiControlNetStack2(inputs: CRMultiControlNetStack2Inputs): CRMultiControlNetStack2Outputs & { __id: string; inputs: CRMultiControlNetStack2InputPaths }"
    );
    expect(code).toContain('"CONTROL NET": NodeRef<"CONTROL_NET">;');
    expect(code).toContain("  any_input: NodeRef;");
  });

  it("should return only __id for output nodes without outputs", () => {
    const code = generateWorkflowCode(MOCK_NODE_DEFS);

    expect(code).toContain("SaveImage(inputs: SaveImageInputs): { __id: string; inputs: SaveImageInputPaths }");
    expect(code).toContain("return { __id: id, inputs: inputPaths };");
  });

  it("should apply enumOverrides for empty clip combo inputs", () => {
    const defs: NodeDefsResponse = {
      CLIPLoader: {
        input: {
          required: {
            clip_name: [[], { tooltip: "Clip name" }],
            type: [["stable_diffusion", "sd3"], { tooltip: "Type" }]
          },
          hidden: {}
        },
        input_order: {
          required: ["clip_name", "type"],
          hidden: []
        },
        output: ["CLIP"],
        output_is_list: [false],
        output_name: ["CLIP"],
        name: "CLIPLoader",
        display_name: "CLIPLoader",
        description: "",
        category: "loaders",
        python_module: "",
        output_node: false,
        output_tooltips: [""]
      }
    };

    const code = generateWorkflowCode(defs, {
      enumOverrides: {
        "CLIPLoader.clip_name": ["clip_a.safetensors", "clip_b.safetensors"]
      }
    });

    expect(code).toContain('clip_name: "clip_a.safetensors" | "clip_b.safetensors";');
    expect(code).toContain('type: "stable_diffusion" | "sd3";');
  });
});
