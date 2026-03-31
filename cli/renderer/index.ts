import { TerminalRenderer } from "cli/renderer/terminal";
import { JsonRenderer } from "cli/renderer/json";
import { QuietRenderer } from "cli/renderer/quiet";
import { TuiRenderer, isTuiAvailable } from "cli/renderer/tui";

export { isTuiAvailable } from "cli/renderer/tui";
export type { TerminalRenderer } from "cli/renderer/terminal";
export type { JsonRenderer } from "cli/renderer/json";
export type { QuietRenderer } from "cli/renderer/quiet";
export type { TuiRenderer } from "cli/renderer/tui";
export type { RunResult } from "cli/renderer/json";

export type RenderMode = "json" | "terminal" | "quiet";

export function resolveMode(wantsJson: boolean, wantsQuiet: boolean, noTui = false): RenderMode {
  if (wantsJson) return "json";
  if (wantsQuiet) return "quiet";
  return "terminal";
}

export function createRenderer(
  mode: RenderMode,
  host: string,
  file: string,
  persistent = false,
  noTui = false,
  useTui = false
): TerminalRenderer | JsonRenderer | QuietRenderer | TuiRenderer {
  if (useTui && mode === "terminal" && !noTui && isTuiAvailable()) {
    return new TuiRenderer(host, file, persistent);
  }
  switch (mode) {
    case "json":
      return new JsonRenderer();
    case "terminal":
      return new TerminalRenderer(host, file);
    case "quiet":
      return new QuietRenderer();
  }
}
