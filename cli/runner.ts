import { resolve, basename, extname, dirname } from "path";
import { mkdirSync, writeFileSync } from "fs";
import { ComfyApi } from "src/client";
import { CallWrapper } from "src/call-wrapper";
import { PromptBuilder } from "src/prompt-builder";
import { loadWorkflow, detectOutputNodes } from "cli/utils/fs";
import { coerceValue, isValidNodePath } from "cli/utils/value-parser";
import type { ImageInfo } from "src/types/api";

const EXT_RE = /\.[^.]+$/;

export function isFilePath(output: string): boolean {
  return EXT_RE.test(basename(output));
}

function getTargetExt(output: string): string {
  return extname(output).toLowerCase();
}

function withNumericSuffix(path: string, index: number): string {
  if (index <= 0) return path;
  const extension = extname(path);
  const base = path.slice(0, extension ? -extension.length : undefined);
  return `${base}${index + 1}${extension}`;
}

function makeUniqueKey(base: string, used: Map<string, number>): string {
  const count = used.get(base) ?? 0;
  used.set(base, count + 1);
  return count === 0 ? base : `${base} (${count + 1})`;
}

export interface RunConfig {
  file: string;
  inputs: Array<{ key: string; value: string }>;
  host: string;
  timeout: number;
  output: string;
  download: boolean;
  noDownload: boolean;
  json?: boolean;
  quiet?: boolean;
  token?: string;
  user?: string;
  pass?: string;
  outputNodes?: string[];
}

export interface MediaEntry {
  filename: string;
  url: string;
  local_path?: string;
}

export function parseMediaReference(reference: string): { url: string; localPath: string | null } {
  const arrow = reference.indexOf(" -> ");
  if (arrow === -1) {
    return { url: reference, localPath: null };
  }

  return {
    url: reference.slice(0, arrow),
    localPath: reference.slice(arrow + 4)
  };
}

export async function extractMediaFromOutputs(
  host: string,
  outputs: Record<string, any>,
  outputPath: string | null
): Promise<Record<string, string>> {
  const media: Record<string, string> = {};
  const usedLabels = new Map<string, number>();
  const savedFileCounts = new Map<string, number>();

  function findImages(obj: any): ImageInfo[] {
    if (!obj || typeof obj !== "object") return [];
    if (Array.isArray(obj.images)) return obj.images;
    let result: ImageInfo[] = [];
    for (const val of Object.values(obj)) {
      result = result.concat(findImages(val));
    }
    return result;
  }

  const allImages = findImages(outputs);

  for (const img of allImages) {
    if (!img.filename) continue;

    const params = new URLSearchParams({
      filename: img.filename,
      type: img.type || "output",
      subfolder: img.subfolder || ""
    });

    const baseUrl = host.replace(/\/+$/, "");
    const url = `${baseUrl}/view?${params}`;
    const defaultLabel = img.subfolder ? `${img.subfolder}/${img.filename}` : img.filename;
    let label = defaultLabel;
    let reference = url;

    if (outputPath) {
      try {
        const targetExt = getTargetExt(outputPath);

        if (isFilePath(outputPath)) {
          const imgExt = extname(img.filename).toLowerCase();
          if (imgExt !== targetExt) continue;

          const dir = dirname(outputPath);
          mkdirSync(dir, { recursive: true });
          const saveIndex = savedFileCounts.get(outputPath) ?? 0;
          const localPath = withNumericSuffix(outputPath, saveIndex);

          const res = await fetch(url);
          if (res.ok) {
            const buf = await res.arrayBuffer();
            writeFileSync(localPath, new Uint8Array(buf));
            savedFileCounts.set(outputPath, saveIndex + 1);
            label = basename(localPath);
            reference = `${url} -> ${localPath}`;
          }
        } else {
          mkdirSync(outputPath, { recursive: true });
          const baseLocalPath = resolve(outputPath, basename(img.filename));
          const saveIndex = savedFileCounts.get(baseLocalPath) ?? 0;
          const localPath = withNumericSuffix(baseLocalPath, saveIndex);

          const res = await fetch(url);
          if (res.ok) {
            const buf = await res.arrayBuffer();
            writeFileSync(localPath, new Uint8Array(buf));
            savedFileCounts.set(baseLocalPath, saveIndex + 1);
            label = basename(localPath);
            reference = `${url} -> ${localPath}`;
          }
        }
      } catch {}
    }

    media[makeUniqueKey(label, usedLabels)] = reference;
  }

  return media;
}

export async function runWorkflow(config: RunConfig, callbacks: RunCallbacks): Promise<any> {
  const workflow = await loadWorkflow(config.file);
  let outputNodes = config.outputNodes || detectOutputNodes(workflow);

  if (outputNodes.length === 0) {
    for (const nodeId of Object.keys(workflow)) {
      if (workflow[nodeId].class_type === "VAEDecode") {
        outputNodes.push(nodeId);
      }
    }
  }

  const builder = new PromptBuilder(workflow, [], outputNodes as any);

  for (const { key, value } of config.inputs) {
    if (!isValidNodePath(key)) {
      throw new Error(`Invalid input path "${key}": expected format <node_id>.inputs.<field_name>`);
    }
    const nodeId = key.split(".")[0];
    if (!workflow[nodeId]) {
      throw new Error(`Node "${nodeId}" not found in workflow`);
    }
    const coercedValue = coerceValue(value);
    builder.inputRaw(key, coercedValue);
  }

  let credentials: any;
  if (config.token) {
    credentials = { type: "bearer_token", token: config.token };
  } else if (config.user && config.pass) {
    credentials = { type: "basic", username: config.user, password: config.pass };
  }

  const client = new ComfyApi(config.host, undefined, credentials ? { credentials } : undefined);
  const timeoutHandle = setTimeout(() => {}, config.timeout);
  if (timeoutHandle.unref) timeoutHandle.unref();

  try {
    await client.init(5, 2000).waitForReady();
    callbacks.onConnect();

    const callWrapper = new CallWrapper(client, builder as any)
      .onPending((id) => callbacks.onPending(id ?? ""))
      .onProgress((info) => callbacks.onProgress(info))
      .onOutput((key, data) => callbacks.onOutput(String(key), data))
      .onFinished((data) => callbacks.onFinished(data))
      .onFailed((err) => callbacks.onFailed(err));

    const result = await Promise.race([
      callWrapper.run(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Execution timed out after ${config.timeout}ms`)), config.timeout)
      )
    ]);

    if (result === false) {
      throw new Error("Workflow execution failed");
    }

    return result;
  } finally {
    clearTimeout(timeoutHandle);
    client.destroy();
  }
}

export interface RunCallbacks {
  onConnect: () => void;
  onPending: (promptId: string) => void;
  onProgress: (info: any) => void;
  onOutput: (key: string, data: any) => void;
  onFinished: (result: any) => void;
  onFailed: (err: Error) => void;
  info: (msg: string) => void;
  blank: () => void;
}

export function buildResultOverrides(inputs: Array<{ key: string; value: string }>): Record<string, string> {
  return inputs.reduce((acc, { key, value }) => ({ ...acc, [key]: value }), {});
}
