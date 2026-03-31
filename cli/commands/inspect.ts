import { loadWorkflow, detectOutputNodes } from "cli/utils/fs";

const c = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`
};

export interface InspectResult {
  file: string;
  nodeCount: number;
  nodes: Array<{
    id: string;
    classType: string;
    inputs: string[];
    isOutput: boolean;
  }>;
  outputNodeIds: string[];
  availablePaths: string[];
}

export async function buildInspectData(filePath: string): Promise<InspectResult> {
  const workflow = await loadWorkflow(filePath);
  const outputNodeIds = detectOutputNodes(workflow);
  const nodes: InspectResult["nodes"] = [];
  const allPaths: string[] = [];

  const sortedIds = Object.keys(workflow).sort((a, b) => Number(a) - Number(b));

  for (const nodeId of sortedIds) {
    const node = workflow[nodeId];
    const classType = node.class_type || "Unknown";
    const inputs = Object.keys(node.inputs || {}).filter((key) => key === "text" || !Array.isArray(node.inputs[key]));
    const isOutput = outputNodeIds.includes(nodeId);

    nodes.push({ id: nodeId, classType, inputs, isOutput });

    for (const inputName of inputs) {
      allPaths.push(`${nodeId}.inputs.${inputName}`);
    }
  }

  return {
    file: filePath,
    nodeCount: sortedIds.length,
    nodes,
    outputNodeIds,
    availablePaths: allPaths
  };
}

export async function renderInspect(data: InspectResult, json: boolean): Promise<void> {
  if (json) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  console.log(c.bold(`Workflow: ${data.file}`) + c.dim(` (${data.nodeCount} nodes)`));
  console.log();

  for (const node of data.nodes) {
    const label = node.isOutput ? c.green(`${node.classType} (output)`) : node.classType;
    console.log(`  ${c.cyan(`Node ${node.id}`)}  ${label}`);

    if (node.inputs.length > 0) {
      console.log(`    inputs: ${node.inputs.join(", ")}`);
    }
    console.log();
  }

  if (data.outputNodeIds.length > 0) {
    console.log(c.dim("Output nodes:") + ` ${data.outputNodeIds.join(", ")}`);
  } else {
    console.log(c.yellow("No output nodes detected."));
    console.log(c.dim("Use --output-nodes <id,id> to specify output nodes manually."));
  }
  console.log();

  console.log(c.dim("Available -i paths:"));
  for (const path of data.availablePaths) {
    console.log(`  ${path}`);
  }
}
