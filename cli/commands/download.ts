import { ComfyApi } from "src/client";
import { extractMediaFromOutputs } from "cli/runner";

const c = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`
};

export async function downloadOutputs(
  host: string,
  promptId: string,
  outputDir: string,
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

  try {
    await client.init(5, 2000).waitForReady();
    const history = await client.getHistory(promptId);

    if (!history || !history.status?.completed) {
      const status = history?.status?.status_str || "unknown";
      if (json) {
        console.log(
          JSON.stringify({ prompt_id: promptId, status, error: "Execution not completed or not found" }, null, 2)
        );
      } else {
        console.log(c.red("Error") + `: prompt ${c.cyan(promptId)} status is "${status}"`);
      }
      return;
    }

    const outputs = history.outputs;
    if (!outputs || Object.keys(outputs).length === 0) {
      if (json) {
        console.log(JSON.stringify({ prompt_id: promptId, status: "completed", outputs: {} }, null, 2));
      } else {
        console.log(c.dim("No outputs found for prompt") + ` ${c.cyan(promptId)}`);
      }
      return;
    }

    const media = await extractMediaFromOutputs(host, outputs, outputDir);

    if (json) {
      console.log(JSON.stringify({ prompt_id: promptId, status: "completed", outputs, _media: media }, null, 2));
    } else {
      console.log(c.green("Downloaded outputs") + ` from ${c.cyan(promptId)}:`);
      for (const [filename, url] of Object.entries(media)) {
        console.log(`  ${c.cyan(filename)}: ${url}`);
      }
    }
  } finally {
    client.destroy();
  }
}
