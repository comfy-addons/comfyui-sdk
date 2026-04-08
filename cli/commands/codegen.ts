import { writeFile } from "fs/promises";
import { resolve } from "path";
import { ComfyApi } from "src/client";
import { generateWorkflowCode } from "src/codegen";

const c = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`
};

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

    const code = generateWorkflowCode(defs);
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
