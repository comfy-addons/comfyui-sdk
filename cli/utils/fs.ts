import { readFileSync } from "fs";
import { resolve } from "path";
import { NodeData } from "src/types/api";

const NUMERIC_KEY_RE = /^\d+$/;

export async function loadWorkflow(filePath: string): Promise<NodeData> {
  const text = readFileSync(resolve(filePath), "utf8");
  const json: unknown = JSON.parse(text);

  if (typeof json !== "object" || json === null || Array.isArray(json)) {
    throw new Error(`Invalid workflow "${filePath}": expected a JSON object at the top level`);
  }

  const keys = Object.keys(json);
  if (keys.length === 0) {
    throw new Error(`Invalid workflow "${filePath}": workflow contains no nodes`);
  }

  for (const key of keys) {
    if (!NUMERIC_KEY_RE.test(key)) {
      throw new Error(`Invalid workflow "${filePath}": key "${key}" is not a numeric node ID`);
    }
  }

  return json as NodeData;
}

export function detectOutputNodes(workflow: NodeData): string[] {
  const results: string[] = [];

  for (const nodeId of Object.keys(workflow)) {
    const node = workflow[nodeId];
    if (node.class_type === "SaveImage" || node.class_type === "PreviewImage") {
      results.push(nodeId);
    }
  }

  return results;
}
