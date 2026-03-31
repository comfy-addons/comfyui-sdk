import { ComfyApi } from "src/client";

const c = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`
};

export async function showQueue(
  host: string,
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
    const queue = await client.getQueue();

    const runningCount = queue.queue_running.length;
    const pendingCount = queue.queue_pending.length;

    if (json) {
      console.log(JSON.stringify({ running: runningCount, pending: pendingCount, queue }, null, 2));
      return;
    }

    if (runningCount === 0 && pendingCount === 0) {
      console.log(c.dim("Queue is empty."));
      return;
    }

    console.log(`${c.green("Running")}: ${runningCount}  |  ${c.cyan("Pending")}: ${pendingCount}`);

    if (runningCount > 0) {
      console.log();
      console.log(c.green("Running:"));
      for (const item of queue.queue_running) {
        const promptId = item[1];
        const number = item[0];
        console.log(`  [${number}] ${c.cyan(promptId)}`);
      }
    }

    if (pendingCount > 0) {
      console.log();
      console.log(c.cyan("Pending:"));
      for (const item of queue.queue_pending) {
        const promptId = item[1];
        const number = item[0];
        console.log(`  [${number}] ${c.cyan(promptId)}`);
      }
    }
  } finally {
    client.destroy();
  }
}
