import { parseArgs, USAGE_TEXT } from "cli/args";
import { runWorkflow, buildResultOverrides, extractMediaFromOutputs } from "cli/runner";
import { createRenderer, resolveMode } from "cli/renderer/index";
import type { RunResult } from "cli/renderer/json";
import { buildInspectData, renderInspect } from "cli/commands/inspect";
import { listResources, isValidResource } from "cli/commands/list";
import { downloadOutputs } from "cli/commands/download";
import { showQueue } from "cli/commands/queue";
import { watchMode } from "cli/commands/watch";
import { codegenWorkflowBuilder } from "cli/commands/codegen";

const VERSION = "0.3.0";

import { isFilePath } from "cli/runner";

function buildMedia(
  host: string,
  outputs: Record<string, any> | undefined,
  download: boolean,
  outputDir: string
): Promise<Record<string, string>> {
  if (!outputs) return Promise.resolve({});
  const shouldDownload = download || isFilePath(outputDir);
  return extractMediaFromOutputs(host, outputs, shouldDownload ? outputDir : null);
}

export async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(USAGE_TEXT);
    return;
  }

  if (args.version) {
    console.log(`cfli v${VERSION}`);
    return;
  }

  switch (args.subcommand) {
    case "inspect":
      return cmdInspect(args);
    case "list":
      return cmdList(args);
    case "queue":
      return cmdQueue(args);
    case "download":
      return cmdDownload(args);
    case "codegen":
      return cmdCodegen(args);
    case "run":
    default:
      if (args.watch) {
        return cmdWatch(args);
      }
      return cmdRun(args);
  }
}

async function cmdRun(args: ReturnType<typeof parseArgs>): Promise<void> {
  if (!args.file) {
    console.error("Error: -f/--file is required\n");
    console.log(USAGE_TEXT);
    return;
  }

  const mode = resolveMode(args.json, args.quiet);
  const renderer = createRenderer(mode, args.host, args.file, false, args.noTui);

  const startTime = performance.now();
  let exitCode = 0;

  try {
    const rawResult = await runWorkflow(
      {
        file: args.file,
        inputs: args.inputs,
        host: args.host,
        timeout: args.timeout,
        output: args.output,
        download: args.download,
        noDownload: args.noDownload,
        json: args.json,
        quiet: args.quiet,
        token: args.token,
        user: args.user,
        pass: args.pass,
        outputNodes: args.outputNodes
      },
      {
        onConnect: () => renderer.onConnect(),
        onPending: (id) => renderer.onPending(id),
        onProgress: (info) => renderer.onProgress(info),
        onOutput: (key, data) => renderer.onOutput(key, data),
        onFinished: (_data) => {},
        onFailed: (err) => renderer.onFailed(err),
        info: (msg) => renderer.info(msg),
        blank: () => renderer.blank()
      }
    );

    const media = await buildMedia(args.host, rawResult, args.download, args.output);
    const durationMs = Math.round(performance.now() - startTime);

    const runResult: RunResult = {
      status: "completed",
      duration_ms: durationMs,
      server: { host: args.host },
      overrides: buildResultOverrides(args.inputs),
      outputs: rawResult,
      _media: media
    };

    if (args.json) {
      renderer.render(runResult);
    } else {
      renderer.onFinished(runResult);
    }
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    const durationMs = Math.round(performance.now() - startTime);
    const runResult: RunResult = {
      status: "failed",
      duration_ms: durationMs,
      server: { host: args.host },
      overrides: buildResultOverrides(args.inputs),
      error: { type: error.constructor.name, message: error.message }
    };

    if (args.json) {
      renderer.render(runResult);
    } else {
      renderer.onFailed(error);
    }

    exitCode = 1;
  }

  process.exit(exitCode);
}

async function cmdInspect(args: ReturnType<typeof parseArgs>): Promise<void> {
  if (!args.file) {
    console.error("Error: -f/--file is required for inspect\n");
    console.log(USAGE_TEXT);
    return;
  }

  const data = await buildInspectData(args.file);
  await renderInspect(data, args.json);
}

async function cmdList(args: ReturnType<typeof parseArgs>): Promise<void> {
  if (!args.resource) {
    console.error("Error: resource argument required. Usage: cfli list <checkpoints|loras|embeddings|samplers>\n");
    console.log(USAGE_TEXT);
    return;
  }

  if (!isValidResource(args.resource)) {
    console.error(`Error: unknown resource "${args.resource}". Available: checkpoints, loras, embeddings, samplers\n`);
    return;
  }

  await listResources(args.host, args.resource, args.json, args.token, args.user, args.pass);
}

async function cmdQueue(args: ReturnType<typeof parseArgs>): Promise<void> {
  await showQueue(args.host, args.json, args.token, args.user, args.pass);
}

async function cmdDownload(args: ReturnType<typeof parseArgs>): Promise<void> {
  if (!args.promptId) {
    console.error("Error: prompt_id argument required. Usage: cfli download <prompt_id>\n");
    console.log(USAGE_TEXT);
    return;
  }

  await downloadOutputs(args.host, args.promptId, args.output, args.json, args.token, args.user, args.pass);
}

async function cmdCodegen(args: ReturnType<typeof parseArgs>): Promise<void> {
  await codegenWorkflowBuilder(args.host, args.output, args.json, args.token, args.user, args.pass);
}

async function cmdWatch(args: ReturnType<typeof parseArgs>): Promise<void> {
  if (!args.file) {
    console.error("Error: -f/--file is required for watch mode\n");
    console.log(USAGE_TEXT);
    return;
  }

  await watchMode(
    {
      file: args.file,
      inputs: args.inputs,
      host: args.host,
      timeout: args.timeout,
      output: args.output,
      download: args.download,
      noDownload: args.noDownload,
      json: args.json,
      quiet: args.quiet,
      token: args.token,
      user: args.user,
      pass: args.pass,
      outputNodes: args.outputNodes
    },
    args.noTui
  );
}
