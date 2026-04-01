import type { NodeProgress } from "src/types/api";
import { formatProgressBar } from "cli/utils/progress";
import type { RunResult } from "cli/renderer/json";
import { parseMediaReference } from "cli/runner";

const c = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  blue: (s: string) => `\x1b[34m${s}\x1b[0m`
};

const CLR = "\x1b[2K";

export class TerminalRenderer {
  private host: string;
  private file: string;
  private hasProgressLine = false;
  private lastNode = "";

  constructor(host: string, file: string) {
    this.host = host;
    this.file = file;
  }

  onConnect(): void {
    console.log(c.green("Connected") + ` to ${this.host}`);
  }

  onPending(promptId: string): void {
    console.log(c.yellow("Queued") + ` prompt ${promptId}`);
  }

  onProgress(info: NodeProgress): void {
    const bar = formatProgressBar(info.value, info.max);
    const node = c.cyan(`Node ${info.node}`);
    const line = `${node}: ${bar}`;

    if (this.hasProgressLine && this.lastNode === String(info.node)) {
      process.stdout.write(`\r${CLR}${line}`);
    } else {
      if (this.hasProgressLine) {
        process.stdout.write(`\n`);
      }
      process.stdout.write(line);
      this.hasProgressLine = true;
      this.lastNode = String(info.node);
    }
  }

  onOutput(key: string): void {
    if (this.hasProgressLine) {
      process.stdout.write(`\n`);
      this.hasProgressLine = false;
    }
    console.log(c.green("Output ready") + `: ${key}`);
  }

  onFinished(result: RunResult): void {
    if (this.hasProgressLine) {
      process.stdout.write(`\n`);
      this.hasProgressLine = false;
    }

    const duration = c.dim(`${result.duration_ms}ms`);
    console.log(c.bold(c.green("Done")) + ` ${this.file} in ${duration}`);

    if (result.outputs) {
      const keys = Object.keys(result.outputs);
      if (keys.length > 0) {
        console.log(c.dim("Results"));
        for (const key of keys) {
          console.log(`  ${c.green("output")} ${c.cyan(key)}`);
        }
      }
    }

    if (result._media && Object.keys(result._media).length > 0) {
      console.log(c.dim("Images"));
      for (const [filename, url] of Object.entries(result._media)) {
        const parsed = parseMediaReference(url);
        console.log(`  ${c.blue(filename)}: ${parsed.localPath ?? parsed.url}`);
      }
    }
  }

  onFailed(err: Error): void {
    if (this.hasProgressLine) {
      process.stdout.write(`\n`);
      this.hasProgressLine = false;
    }
    console.log(c.bold(c.red("Error")) + `: ${err.message}`);
  }

  render(result: RunResult): void {
    console.log(JSON.stringify(result, null, 2));
  }

  info(msg: string): void {
    console.log(c.dim(msg));
  }

  blank(): void {
    console.log();
  }
}
