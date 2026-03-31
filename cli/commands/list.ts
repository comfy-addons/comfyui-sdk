import { ComfyApi } from "src/client";

export type ListResource = "checkpoints" | "loras" | "embeddings" | "samplers";

const VALID_RESOURCES = new Set<string>(["checkpoints", "loras", "embeddings", "samplers"]);

export function isValidResource(value: string): value is ListResource {
  return VALID_RESOURCES.has(value);
}

export async function listResources(
  host: string,
  resource: ListResource,
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

    if (json) {
      await renderJson(client, resource);
    } else {
      await renderTerminal(client, resource);
    }
  } finally {
    client.destroy();
  }
}

async function renderJson(client: ComfyApi, resource: ListResource) {
  if (resource === "samplers") {
    const data = await client.getSamplerInfo();
    console.log(JSON.stringify({ resource, ...data }, null, 2));
  } else {
    const items = await fetchStringList(client, resource);
    console.log(JSON.stringify({ resource, count: items.length, items }, null, 2));
  }
}

async function renderTerminal(client: ComfyApi, resource: ListResource) {
  if (resource === "samplers") {
    const data = await client.getSamplerInfo();
    const samplers = Array.isArray(data.sampler) ? data.sampler : [];
    const schedulers = Array.isArray(data.scheduler) ? data.scheduler : [];

    console.log(`samplers (${samplers.length}):`);
    for (const s of samplers) console.log(`  ${s}`);
    if (schedulers.length > 0) {
      console.log();
      console.log(`schedulers (${schedulers.length}):`);
      for (const s of schedulers) console.log(`  ${s}`);
    }
  } else {
    const items = await fetchStringList(client, resource);
    console.log(`${resource} (${items.length}):`);
    for (const item of items) console.log(`  ${item}`);
  }
}

async function fetchStringList(client: ComfyApi, resource: ListResource): Promise<string[]> {
  switch (resource) {
    case "checkpoints":
      return client.getCheckpoints();
    case "loras":
      return client.getLoras();
    case "embeddings":
      return client.getEmbeddings();
    case "samplers":
      return [];
  }
}
