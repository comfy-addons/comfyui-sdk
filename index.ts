export { ComfyApi } from "./src/client";
export { CallWrapper } from "./src/call-wrapper";
export { ComfyPool, EQueueMode } from "./src/pool";
export { PromptBuilder } from "./src/prompt-builder";
export { WorkflowBuilder, NodeRef, OutputNodeId, ComfyOutputValue, ComfyNodeOutput } from "./src/workflow-builder";

export { TSamplerName, TSchedulerName } from "./src/types/sampler";

/**
 * Polyfill for CustomEvent in old NodeJS versions
 */
if (typeof CustomEvent === "undefined") {
  (global as any).CustomEvent = class CustomEvent extends Event {
    detail: any;
    constructor(event: any, params: any = {}) {
      super(event, params);
      this.detail = params.detail || null;
    }
  };
}
