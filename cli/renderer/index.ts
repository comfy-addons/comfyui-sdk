import { TerminalRenderer } from "cli/renderer/terminal";
import { JsonRenderer } from "cli/renderer/json";
import { QuietRenderer } from "cli/renderer/quiet";

export type { TerminalRenderer } from "cli/renderer/terminal";
export type { JsonRenderer } from "cli/renderer/json";
export type { QuietRenderer } from "cli/renderer/quiet";
export type { RunResult } from "cli/renderer/json";

export function createRenderer(
  mode: "json" | "terminal" | "quiet",
  host: string,
  file: string
): TerminalRenderer | JsonRenderer | QuietRenderer {
  switch (mode) {
    case "json":
      return new JsonRenderer();
    case "terminal":
      return new TerminalRenderer(host, file);
    case "quiet":
      return new QuietRenderer();
  }
}
