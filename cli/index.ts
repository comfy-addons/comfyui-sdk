import { parseArgs, USAGE_TEXT } from "cli/args";
import { runWorkflow, buildResultOverrides, extractMediaFromOutputs } from "cli/runner";
import { createRenderer } from "cli/renderer/index";
import type { RunResult } from "cli/renderer/json";

const VERSION = "0.2.49";

function buildMedia(
  host: string,
  outputs: Record<string, any> | undefined,
  download: boolean,
  outputDir: string
): Promise<Record<string, string>> {
  if (!outputs) return Promise.resolve({});
  return extractMediaFromOutputs(host, outputs, download ? outputDir : null);
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

  if (!args.file) {
    console.error("Error: -f/--file is required\n");
    console.log(USAGE_TEXT);
    return;
  }

  const mode = args.json ? "json" : args.quiet ? "quiet" : "terminal";
  const renderer = createRenderer(mode, args.host, args.file);

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
