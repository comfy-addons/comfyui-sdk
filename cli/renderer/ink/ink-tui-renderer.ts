import React from "react";
import { render, type Instance as InkInstance } from "ink";
import { App } from "./app";
import { createTuiStore } from "./state";
import type { TuiStore, TuiAction } from "./state";
import type { RunResult } from "cli/renderer/json";

export function isInkAvailable(): boolean {
  return Boolean(process.stdout.isTTY && process.stdin.isTTY);
}

export class InkTuiRenderer {
  private host: string;
  private file: string;
  private persistent: boolean;
  private store: TuiStore | null = null;
  private inkInstance: InkInstance | null = null;

  constructor(host: string, file: string, persistent = false) {
    this.host = host;
    this.file = file;
    this.persistent = persistent;
  }

  private ensureStarted(): void {
    if (this.inkInstance) return;
    this.store = createTuiStore(this.host, this.file);
    this.inkInstance = render(React.createElement(App, { store: this.store, persistent: this.persistent }));
  }

  private dispatch(action: TuiAction): void {
    this.ensureStarted();
    this.store!.dispatch(action);
  }

  onConnect(): void {
    this.dispatch({ type: "CONNECT" });
  }

  startRun(runNumber: number): void {
    this.dispatch({ type: "START_RUN", runNumber });
  }

  onPending(promptId: string): void {
    this.dispatch({ type: "PENDING", promptId });
  }

  onProgress(info: { value: number; max: number; node: string; prompt_id: string }): void {
    this.dispatch({ type: "PROGRESS", value: info.value, max: info.max, node: String(info.node) });
  }

  onOutput(key: string): void {
    this.dispatch({ type: "OUTPUT", key });
  }

  onFinished(result: RunResult): void {
    this.dispatch({ type: "FINISHED", result });
  }

  onFailed(err: Error): void {
    this.dispatch({ type: "FAILED", message: err.message });
  }

  info(msg: string): void {
    this.dispatch({ type: "ADD_FEED", entry: { type: "feed", text: msg, tone: "muted", source: "system", runNumber: null } });
  }

  blank(): void {
    this.dispatch({ type: "ADD_FEED", entry: { type: "feed", text: "", tone: "default", source: "system", runNumber: null } });
  }

  addServerLog(message: string): void {
    this.dispatch({ type: "ADD_SERVER_LOG", message });
  }

  showWatchStatus(msg: string): void {
    this.dispatch({ type: "WATCH_STATUS", message: msg });
  }

  showInterrupt(runNumber: number): void {
    this.dispatch({ type: "INTERRUPT", runNumber });
  }

  showRunComplete(runNumber: number, durationMs: number): void {
    this.dispatch({ type: "RUN_COMPLETE", runNumber, durationMs });
  }

  showRunFailed(runNumber: number, message: string): void {
    this.dispatch({ type: "RUN_FAILED", runNumber, message });
  }

  resetRun(): void {
    this.dispatch({ type: "RESET_RUN" });
  }

  stop(): void {
    if (this.inkInstance) {
      this.inkInstance.unmount();
      this.inkInstance = null;
      this.store = null;
    }
  }

  render(result: RunResult): void {
    console.log(JSON.stringify(result, null, 2));
  }
}
