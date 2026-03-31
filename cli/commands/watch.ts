import { ComfyApi } from "src/client";
import { CallWrapper } from "src/call-wrapper";
import { PromptBuilder } from "src/prompt-builder";
import { loadWorkflow, detectOutputNodes } from "cli/utils/fs";
import { coerceValue, isValidNodePath } from "cli/utils/value-parser";
import { extractMediaFromOutputs, buildResultOverrides, isFilePath } from "cli/runner";
import { createRenderer, resolveMode } from "cli/renderer/index";
import type { TuiRenderer } from "cli/renderer/tui";
import type { RunResult } from "cli/renderer/json";
import type { RunConfig } from "cli/runner";

const c = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  blue: (s: string) => `\x1b[34m${s}\x1b[0m`
};

const DEBOUNCE_MS = 500;

interface WatchState {
  runNumber: number;
  abortController: AbortController | null;
  debounceTimer: Timer | null;
  running: boolean;
  client: ComfyApi | null;
}

function isTui(renderer: any): renderer is TuiRenderer {
  return renderer && typeof renderer.showWatchStatus === "function";
}

export async function watchMode(config: RunConfig, noTui = false): Promise<void> {
  const mode = resolveMode(config.json, config.quiet);
  const useTui = mode === "terminal" && !noTui;
  const renderer = createRenderer(mode, config.host, config.file, useTui, noTui, useTui);

  const state: WatchState = {
    runNumber: 0,
    abortController: null,
    debounceTimer: null,
    running: false,
    client: null
  };

  if (!useTui) {
    console.log(c.bold(c.blue("Watching")) + ` ${config.file} ${c.dim("(Ctrl+C to stop)")}`);
    console.log();
  } else {
    isTui(renderer) && renderer.showWatchStatus(`Watching ${config.file} (Ctrl+C to stop)`);
  }

  let credentials: any;
  if (config.token) {
    credentials = { type: "bearer_token", token: config.token };
  } else if (config.user && config.pass) {
    credentials = { type: "basic", username: config.user, password: config.pass };
  }

  state.client = new ComfyApi(config.host, undefined, credentials ? { credentials } : undefined);

  await state.client.init(5, 2000).waitForReady();
  if (isTui(renderer)) {
    renderer.onConnect();
  } else {
    console.log(c.green("Connected") + ` to ${config.host}`);
    console.log();
  }

  const runOnce = async () => {
    state.runNumber++;
    const runNum = state.runNumber;
    const startTime = performance.now();
    let interrupted = false;

    if (isTui(renderer)) {
      renderer.resetRun();
    }

    try {
      const rawResult = await executeWorkflow(state.client!, config, renderer);
      const durationMs = Math.round(performance.now() - startTime);

      if (isTui(renderer)) {
        renderer.showRunComplete(runNum, durationMs);
      } else if (!config.json) {
        console.log(c.dim(`[${c.bold(`Run #${runNum}`)}]`) + ` completed in ${c.dim(`${durationMs}ms`)}`);
      }

      const shouldDownload = config.download || isFilePath(config.output);
      const media = await extractMediaFromOutputs(config.host, rawResult, shouldDownload ? config.output : null);
      const runResult: RunResult = {
        status: "completed",
        duration_ms: durationMs,
        server: { host: config.host },
        overrides: buildResultOverrides(config.inputs),
        outputs: rawResult,
        _media: media
      };

      if (config.json) {
        renderer.render(runResult);
      } else {
        renderer.onFinished(runResult);
      }
    } catch (err) {
      if ((err as any)?.aborted) return;

      const error = err instanceof Error ? err : new Error(String(err));
      const msg = error.message;

      if (msg.includes("interrupted") || msg.includes("Interrupted") || msg.includes("Workflow execution failed")) {
        interrupted = true;
        if (isTui(renderer)) {
          renderer.showInterrupt(runNum);
        }
      } else if (isTui(renderer)) {
        renderer.showRunFailed(runNum, error.message);
      } else if (!config.json) {
        console.log(c.red(`[${c.bold(`Run #${runNum}`)}]`) + ` failed: ${error.message}`);
      } else {
        const runResult: RunResult = {
          status: "failed",
          duration_ms: Math.round(performance.now() - startTime),
          server: { host: config.host },
          overrides: buildResultOverrides(config.inputs),
          error: { type: error.constructor.name, message: error.message }
        };
        renderer.render(runResult);
      }
    }

    if (!interrupted && !isTui(renderer) && !config.json) {
      console.log();
      console.log(c.dim(`${c.blue("watching")} ${config.file} ...`));
    }
  };

  await runOnce();

  const { watch } = await import("fs");

  const watcher = watch(config.file, async (eventType: string) => {
    if (eventType !== "change") return;

    if (state.debounceTimer) {
      clearTimeout(state.debounceTimer);
    }

    state.debounceTimer = setTimeout(async () => {
      state.debounceTimer = null;

      if (state.running) {
        if (isTui(renderer)) {
          renderer.showWatchStatus(`change detected, interrupting Run #${state.runNumber}...`);
        } else if (!config.json) {
          console.log();
          console.log(c.yellow("[change detected]") + ` ${c.dim(`interrupting Run #${state.runNumber}...`)}`);
        }

        try {
          await state.client!.interrupt();
        } catch {}

        const waitStart = Date.now();
        while (state.running && Date.now() - waitStart < 10000) {
          await new Promise((r) => setTimeout(r, 100));
        }

        if (state.running) {
          if (isTui(renderer)) {
            renderer.showWatchStatus("previous run did not stop, starting new run anyway");
          } else if (!config.json) {
            console.log(c.yellow("[warning]") + ` previous run did not stop, starting new run anyway`);
          }
          state.running = false;
        }

        if (isTui(renderer)) {
          renderer.showInterrupt(state.runNumber);
        } else if (!config.json) {
          console.log(c.yellow("[interrupted]") + ` ${c.dim(`Run #${state.runNumber}`)}`);
        }
      }

      state.running = true;
      await runOnce();
      state.running = false;
    }, DEBOUNCE_MS);
  });

  return new Promise<void>(() => {
    process.on("SIGINT", () => {
      if (state.debounceTimer) clearTimeout(state.debounceTimer);
      watcher.close();
      state.client!.destroy();
      if (isTui(renderer)) {
        renderer.stop();
      } else {
        console.log();
        console.log(c.dim("Stopped watching."));
      }
      process.exit(0);
    });
  });
}

async function executeWorkflow(client: ComfyApi, config: RunConfig, renderer: any): Promise<any> {
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

  const callWrapper = new CallWrapper(client, builder as any)
    .onPending((id) => renderer.onPending(id ?? ""))
    .onProgress((info: any) => renderer.onProgress(info))
    .onOutput((key: any, data: any) => renderer.onOutput(String(key), data))
    .onFinished((_data: any) => {})
    .onFailed((err: Error) => {
      if (!err.message.includes("interrupted") && !err.message.includes("Interrupted")) {
        renderer.onFailed(err);
      }
    });

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
}
