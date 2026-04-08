import { writeFile } from "fs/promises";
import { resolve } from "path";
import { ComfyApi } from "src/client";
import { generateWorkflowCode } from "src/codegen";
import { NodeDefsResponse } from "src/types/api";

const c = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`
};

function isEmptyComboInput(def: unknown): boolean {
  if (!Array.isArray(def) || def.length === 0) {
    return false;
  }

  const head = def[0];
  if (Array.isArray(head)) {
    return head.length === 0;
  }

  if (head === "COMBO") {
    const config = def[1];
    if (config && typeof config === "object") {
      const options = (config as { options?: unknown[] }).options;
      return Array.isArray(options) && options.length === 0;
    }
  }

  return false;
}

function mergeUniqueStrings(...lists: string[][]): string[] {
  const merged = new Set<string>();
  for (const list of lists) {
    for (const item of list) {
      if (typeof item === "string" && item.length > 0) {
        merged.add(item);
      }
    }
  }
  return [...merged];
}

async function collectEnumOverrides(client: ComfyApi, defs: NodeDefsResponse): Promise<Record<string, string[]>> {
  const overrides: Record<string, string[]> = {};
  const modelTypes = await client.getModelTypes().catch(() => []);
  const modelTypeSet = new Set(modelTypes);

  const getModels = async (folder: string): Promise<string[]> => {
    if (!modelTypeSet.has(folder)) {
      return [];
    }
    try {
      const models = await client.getModels(folder);
      if (!Array.isArray(models)) {
        return [];
      }
      return models.filter((value): value is string => typeof value === "string");
    } catch {
      return [];
    }
  };

  const textEncoderModels = mergeUniqueStrings(await getModels("clip"), await getModels("text_encoders"));
  const clipGgufModels = mergeUniqueStrings(await getModels("clip_gguf"));

  for (const [nodeName, nodeDef] of Object.entries(defs)) {
    const required = nodeDef.input?.required ?? {};
    const optional = nodeDef.input?.optional ?? {};
    const allInputs = { ...required, ...optional };

    for (const [inputName, inputDef] of Object.entries(allInputs)) {
      if (!/^clip_name\d*$/i.test(inputName)) {
        continue;
      }
      if (!isEmptyComboInput(inputDef)) {
        continue;
      }

      const values = nodeName.toLowerCase().includes("gguf") ? clipGgufModels : textEncoderModels;
      if (values.length > 0) {
        overrides[`${nodeName}.${inputName}`] = values;
      }
    }
  }

  return overrides;
}

export async function codegenWorkflowBuilder(
  host: string,
  output: string,
  json: boolean,
  token?: string,
  user?: string,
  pass?: string
): Promise<void> {
  let credentials: any;
  if (token) {
    credentials = { type: "bearer_token", token };
  } else if (user && pass) {
    credentials = { type: "basic", username: user, password: pass };
  }

  const client = new ComfyApi(host, undefined, credentials ? { credentials } : undefined);
  const outputPath = resolve(output || "./comfyui-nodes.ts");

  try {
    await client.init(5, 2000).waitForReady();
    const defs = await client.getNodeDefs();
    if (!defs) {
      throw new Error("Server returned no node definitions");
    }

    const enumOverrides = await collectEnumOverrides(client, defs);
    const code = generateWorkflowCode(defs, { enumOverrides });
    await writeFile(outputPath, code, "utf8");

    if (json) {
      console.log(JSON.stringify({ output: outputPath, nodes: Object.keys(defs).length }, null, 2));
    } else {
      console.log(`${c.green("Generated")} ${c.cyan(outputPath)}`);
      console.log(c.dim(`Nodes: ${Object.keys(defs).length}`));
    }
  } finally {
    client.destroy();
  }
}
