import { PromptBuilder } from "./prompt-builder";
import { NodeData } from "./types/api";

export type NodeRef<T extends string = string> = [string, number] & { __outputType?: T };

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

  build<I extends string = never, O extends string = never>(config?: {
    inputs?: Record<I, string | string[]>;
    outputs?: Record<O, string>;
  }): PromptBuilder<I, O, NodeData> {
    const inputMap = config?.inputs ?? ({} as Record<I, string | string[]>);
    const outputMap = config?.outputs ?? ({} as Record<O, string>);
    const inputKeys = Object.keys(inputMap) as I[];
    const outputKeys = Object.keys(outputMap) as O[];
    let builder = new PromptBuilder<I, O, NodeData>(this.workflow, inputKeys, outputKeys);

    for (const key of inputKeys) {
      builder = builder.setRawInputNode(key, inputMap[key]);
    }
    for (const key of outputKeys) {
      builder = builder.setRawOutputNode(key, outputMap[key]);
    }

    return builder;
  }
}
