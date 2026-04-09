import { PromptBuilder } from "./prompt-builder";
import { ImageInfo, NodeData } from "./types/api";

export type NodeRef<T extends string = string> = [string, number] & { __outputType?: T };
export type ComfyNodeOutput = Record<string, unknown>;
export type ComfyOutputValue<T extends string = string> = T extends "IMAGE"
  ? ImageInfo[]
  : T extends "INT" | "FLOAT"
    ? number | number[]
    : T extends "STRING"
      ? string | string[]
      : T extends "BOOLEAN"
        ? boolean | boolean[]
        : unknown;
export type OutputNodeId<T extends ComfyNodeOutput = ComfyNodeOutput> = string & { __outputData?: T };

type InferOutputValueMap<OM extends Record<string, string | OutputNodeId<any>>> = {
  [K in keyof OM & string]: OM[K] extends OutputNodeId<infer T> ? T : ComfyNodeOutput;
};

export class WorkflowBuilder {
  private _nodes: NodeData = {};
  private _nextId = 1;

  protected addNode(classType: string, inputs: Record<string, any>, title?: string): string {
    const id = String(this._nextId++);
    this._nodes[id] = {
      inputs: structuredClone(inputs ?? {}),
      class_type: classType,
      _meta: { title: title ?? classType }
    };
    return id;
  }

  protected makeRef<T extends string>(nodeId: string, index: number): NodeRef<T> {
    return [nodeId, index] as NodeRef<T>;
  }

  get workflow(): NodeData {
    return structuredClone(this._nodes);
  }

  build<
    I extends string = never,
    OM extends Record<string, string | OutputNodeId<any>> = Record<never, never>
  >(config?: {
    inputs?: Record<I, string | string[]>;
    outputs?: OM;
  }): PromptBuilder<I, keyof OM & string, NodeData, InferOutputValueMap<OM>> {
    const inputMap = config?.inputs ?? ({} as Record<I, string | string[]>);
    const outputMap = config?.outputs ?? ({} as OM);
    const inputKeys = Object.keys(inputMap) as I[];
    const outputKeys = Object.keys(outputMap) as Array<keyof OM & string>;
    let builder = new PromptBuilder<I, keyof OM & string, NodeData, InferOutputValueMap<OM>>(
      this.workflow,
      inputKeys,
      outputKeys
    );

    for (const key of inputKeys) {
      builder = builder.setRawInputNode(key, inputMap[key]);
    }
    for (const key of outputKeys) {
      builder = builder.setRawOutputNode(key, outputMap[key] as string);
    }

    return builder;
  }
}
