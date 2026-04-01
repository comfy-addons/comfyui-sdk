import { TerminalRenderer } from "cli/renderer/terminal";
import { JsonRenderer } from "cli/renderer/json";
import { QuietRenderer } from "cli/renderer/quiet";
import { InkTuiRenderer, isInkAvailable } from "cli/renderer/ink/ink-tui-renderer";

export { isInkAvailable } from "cli/renderer/ink/ink-tui-renderer";
export type { TerminalRenderer } from "cli/renderer/terminal";
export type { JsonRenderer } from "cli/renderer/json";
export type { QuietRenderer } from "cli/renderer/quiet";
export type { InkTuiRenderer } from "cli/renderer/ink/ink-tui-renderer";
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
): TerminalRenderer | JsonRenderer | QuietRenderer | InkTuiRenderer {
  if (useTui && mode === "terminal" && !noTui && isInkAvailable()) {
    return new InkTuiRenderer(host, file, persistent);
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
