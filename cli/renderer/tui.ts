import type { NodeProgress } from "src/types/api";
import { formatProgressBar } from "cli/utils/progress";
import type { RunResult } from "cli/renderer/json";
import {
  TUI,
  ProcessTerminal,
  Spacer,
  Image,
  matchesKey,
  Key,
  visibleWidth,
  truncateToWidth,
  getCapabilities,
  getImageDimensions,
  calculateImageRows,
  getCellDimensions
} from "@mariozechner/pi-tui";
import type { Component, ImageDimensions } from "@mariozechner/pi-tui";

const S = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  boldOff: "\x1b[22m",
  dimOff: "\x1b[22m",
  fgDefault: "\x1b[39m",
  fgBlack: "\x1b[30m",
  fgRed: "\x1b[31m",
  fgGreen: "\x1b[32m",
  fgYellow: "\x1b[33m",
  fgBlue: "\x1b[34m",
  fgCyan: "\x1b[36m",
  fgGray: "\x1b[90m",
  fgBrightWhite: "\x1b[97m",
  bgHeader: "\x1b[44m\x1b[30m",
  bgFooter: "\x1b[44m\x1b[30m",
  bgFooterOk: "\x1b[42m\x1b[30m",
  bgFooterErr: "\x1b[41m\x1b[97m",
  bgEnd: "\x1b[0m"
};

const SPINNERS = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

const DIVIDER = `\x1b[2m│\x1b[22m`;

class HeaderBar implements Component {
  private host: string;
  private file: string;
  private connected = false;
  private bg: string;

  constructor(host: string, file: string, bg: string) {
    this.host = host;
    this.file = file;
    this.bg = bg;
  }

  setConnected(v: boolean): void {
    this.connected = v;
  }
  setBg(bg: string): void {
    this.bg = bg;
  }
  invalidate(): void {}

  render(width: number): string[] {
    const dot = this.connected ? "\x1b[32m●\x1b[39m" : "\x1b[33m◌\x1b[39m";
    const label = this.connected ? "connected" : "connecting";
    const left = `${dot} ${label}`;
    const right = `\x1b[1mcfli\x1b[22m ${this.file} ${this.host}`;
    const gap = Math.max(2, width - visibleWidth(left) - visibleWidth(right));
    return [`${this.bg}${truncateToWidth(left + " ".repeat(gap) + right, width)}${S.bgEnd}`];
  }
}

class FooterBar implements Component {
  private left = "";
  private right = "";
  private bg: string;

  constructor(bg: string) {
    this.bg = bg;
  }

  set(left: string, right: string): void {
    this.left = left;
    this.right = right;
  }
  setBg(bg: string): void {
    this.bg = bg;
  }
  invalidate(): void {}

  render(width: number): string[] {
    const gap = Math.max(2, width - visibleWidth(this.left) - visibleWidth(this.right));
    return [`${this.bg}${truncateToWidth(this.left + " ".repeat(gap) + this.right, width)}${S.bgEnd}`];
  }
}

class LogArea implements Component {
  private entries: string[] = [];
  private _cache: string[] | null = null;
  private _cacheW = 0;
  private maxRows = 20;

  push(text: string): void {
    this.entries.push(text);
    this._cache = null;
  }

  clear(): void {
    this.entries = [];
    this._cache = null;
  }

  invalidate(): void {
    this._cache = null;
  }

  get length(): number {
    return this.entries.length;
  }

  setMaxRows(n: number): void {
    this.maxRows = n;
    this._cache = null;
  }

  render(width: number): string[] {
    if (width <= 0) return [];
    if (this._cache && this._cacheW === width) return this._cache;
    const cap = Math.max(4, Math.min(this.maxRows, Math.floor(width * 0.4)));
    const visible = this.entries.length > cap ? this.entries.slice(-cap) : this.entries;
    this._cache = visible.map((e) => truncateToWidth(`  ${e}`, width));
    this._cacheW = width;
    return this._cache;
  }
}

class ImagePanel implements Component {
  private image: Image | null = null;
  private label = "";
  private _cache: string[] | null = null;
  private _cacheW = 0;

  set(image: Image, label: string): void {
    this.image = image;
    this.label = label;
    this._cache = null;
  }

  clear(): void {
    this.image = null;
    this.label = "";
    this._cache = null;
  }

  invalidate(): void {
    this._cache = null;
  }

  render(width: number): string[] {
    if (width <= 0) return [];
    if (this._cache && this._cacheW === width) return this._cache;

    const lines: string[] = [];
    if (this.image) {
      lines.push(`  \x1b[2m${this.label}\x1b[22m`);
      const imgLines = this.image.render(width - 2);
      for (const line of imgLines) {
        lines.push("  " + line);
      }
    }
    this._cache = lines;
    this._cacheW = width;
    return this._cache;
  }
}

class SplitPane implements Component {
  private left: Component;
  private right: Component;
  private ratio: number;
  private showRight: boolean;
  private _cache: string[] | null = null;
  private _cacheW = 0;

  constructor(left: Component, right: Component, ratio = 0.6) {
    this.left = left;
    this.right = right;
    this.ratio = ratio;
    this.showRight = true;
  }

  setShowRight(v: boolean): void {
    this.showRight = v;
    this._cache = null;
  }

  invalidate(): void {
    this.left.invalidate?.();
    this.right.invalidate?.();
    this._cache = null;
  }

  render(width: number): string[] {
    if (width <= 0) return [];
    if (!this.showRight) return this.left.render(width);
    if (this._cache && this._cacheW === width) return this._cache;

    const dividerW = 3;
    const usable = width - dividerW;
    const leftW = Math.floor(usable * this.ratio);
    const rightW = usable - leftW;

    const leftLines = this.left.render(leftW);
    const rightLines = this.right.render(rightW);

    const maxLines = Math.max(leftLines.length, rightLines.length, 1);
    const result: string[] = [];

    for (let i = 0; i < maxLines; i++) {
      const left = i < leftLines.length ? leftLines[i] : "";
      const right = i < rightLines.length ? rightLines[i] : "";
      const leftPadded = left + " ".repeat(Math.max(0, leftW - visibleWidth(left)));
      const rightPadded = right + " ".repeat(Math.max(0, rightW - visibleWidth(right)));
      result.push(leftPadded + ` ${DIVIDER} ` + rightPadded);
    }

    this._cache = result;
    this._cacheW = width;
    return this._cache;
  }
}

class FlexSpacer implements Component {
  private getTui: () => TUI | null;
  private getReserved: () => number;
  private minFill: number;

  constructor(getTui: () => TUI | null, getReserved: () => number, minFill = 1) {
    this.getTui = getTui;
    this.getReserved = getReserved;
    this.minFill = minFill;
  }

  invalidate(): void {}

  render(_width: number): string[] {
    const tui = this.getTui();
    if (!tui) return [];
    const rows = tui.terminal.rows;
    const reserved = this.getReserved();
    return Array(Math.max(this.minFill, rows - reserved)).fill("");
  }
}

export function isTuiAvailable(): boolean {
  return Boolean(process.stdout.isTTY && process.stdin.isTTY);
}

function canRenderImages(): boolean {
  try {
    const caps = getCapabilities();
    return caps.images === "kitty" || caps.images === "iterm2";
  } catch {
    return false;
  }
}

async function fetchImageAsBase64(url: string): Promise<{ base64: string; mime: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "image/png";
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    return { base64, mime: contentType };
  } catch {
    return null;
  }
}

export class TuiRenderer {
  private host: string;
  private file: string;
  private started = false;
  private persistent = false;
  private finished = false;
  private tui: TUI | null = null;
  private terminal: ProcessTerminal | null = null;
  private spinnerFrame = 0;
  private spinnerTimer: Timer | null = null;
  private currentNode = "";
  private progressValue = 0;
  private progressMax = 0;
  private connected = false;
  private pendingId = "";
  private onExitCb: (() => void) | null = null;

  private header: HeaderBar;
  private logArea: LogArea;
  private imagePanel: ImagePanel;
  private splitPane: SplitPane;
  private footer: FooterBar;
  private spacer: FlexSpacer;
  private supportsImages: boolean;

  constructor(host: string, file: string, persistent = false) {
    this.host = host;
    this.file = file;
    this.persistent = persistent;
    this.header = new HeaderBar(host, file, S.bgHeader);
    this.logArea = new LogArea();
    this.imagePanel = new ImagePanel();
    this.splitPane = new SplitPane(this.logArea, this.imagePanel, 0.58);
    this.footer = new FooterBar(S.bgFooter);
    this.spacer = new FlexSpacer(
      () => this.tui,
      () => 0
    );
    this.supportsImages = false;
  }

  private ensureStarted(): void {
    if (this.started) return;
    this.started = true;

    this.supportsImages = canRenderImages();

    this.terminal = new ProcessTerminal();
    this.tui = new TUI(this.terminal);

    this.splitPane.setShowRight(false);

    const computeReserved = () => {
      const cols = this.tui?.terminal.columns || 80;
      const rows = this.tui?.terminal.rows || 24;
      const fixed = this.header.render(cols).length + this.footer.render(cols).length + 1;
      const available = Math.max(4, rows - fixed - 3);
      this.logArea.setMaxRows(available);
      return fixed + this.splitPane.render(cols).length;
    };

    this.spacer = new FlexSpacer(() => this.tui, computeReserved, 3);

    this.tui.addChild(this.header);
    this.tui.addChild(this.spacer);
    this.tui.addChild(this.splitPane);
    this.tui.addChild(new Spacer(1));
    this.tui.addChild(this.footer);

    this.tui.start();

    this.tui.addInputListener((data: string) => {
      if (matchesKey(data, Key.ctrl("c"))) {
        this.stop();
        this.onExitCb?.();
        process.exit(130);
      }
      return undefined;
    });

    this.spinnerTimer = setInterval(() => {
      this.spinnerFrame = (this.spinnerFrame + 1) % SPINNERS.length;
      this.updateFooter();
      this.tui?.requestRender();
    }, 100);

    if (this.spinnerTimer.unref) this.spinnerTimer.unref();
  }

  stop(): void {
    if (this.spinnerTimer) {
      clearInterval(this.spinnerTimer);
      this.spinnerTimer = null;
    }
    if (this.tui) {
      this.tui.stop();
      this.tui = null;
      this.terminal = null;
    }
  }

  onExit(cb: () => void): void {
    this.onExitCb = cb;
  }

  resetRun(): void {
    this.finished = false;
    this.currentNode = "";
    this.progressValue = 0;
    this.progressMax = 0;
    this.pendingId = "";
    this.footer.setBg(S.bgFooter);
    this.splitPane.invalidate();
    this.tui?.requestRender(true);
    this.updateFooter();
  }

  private updateFooter(): void {
    if (this.finished || !this.tui) return;
    const sp = SPINNERS[this.spinnerFrame];

    if (!this.connected) {
      this.footer.set(`${sp} connecting`, this.host);
    } else if (this.pendingId) {
      this.footer.set(`${sp} queued`, this.pendingId.slice(0, 16));
    } else if (this.currentNode) {
      const bar = this.progressMax > 0 ? ` ${formatProgressBar(this.progressValue, this.progressMax, 20)}` : "";
      this.footer.set(
        `${sp} node ${this.currentNode}${bar}`,
        this.progressMax > 0 ? `${this.progressValue}/${this.progressMax}` : ""
      );
    } else {
      this.footer.set(`${sp} executing`, "");
    }
    this.tui.requestRender();
  }

  private appendLog(text: string): void {
    this.logArea.push(text);
    this.splitPane.invalidate();
    this.tui?.requestRender();
  }

  onConnect(): void {
    this.ensureStarted();
    this.connected = true;
    this.header.setConnected(true);
    this.updateFooter();
  }

  onPending(promptId: string): void {
    this.ensureStarted();
    this.pendingId = promptId;
    this.updateFooter();
  }

  onProgress(info: NodeProgress): void {
    this.ensureStarted();
    this.pendingId = "";
    this.currentNode = String(info.node);
    this.progressValue = info.value;
    this.progressMax = info.max;
    this.updateFooter();
  }

  onOutput(key: string): void {
    this.ensureStarted();
    this.appendLog(`\x1b[32m  \u2192\x1b[39m output \x1b[36m${key}\x1b[39m`);
  }

  onFinished(result: RunResult): void {
    this.ensureStarted();
    this.currentNode = "";
    this.progressValue = 0;
    this.progressMax = 0;
    this.finished = true;

    this.footer.setBg(S.bgFooterOk);
    this.footer.set("\x1b[1m\u2713 done\x1b[22m", `${result.duration_ms}ms`);

    if (result.outputs) {
      const keys = Object.keys(result.outputs);
      if (keys.length > 0) {
        this.appendLog(`\x1b[2moutputs\x1b[22m ${keys.map((k) => `\x1b[36m${k}\x1b[39m`).join(", ")}`);
      }
    }

    if (result._media && Object.keys(result._media).length > 0) {
      this.appendLog(`\x1b[2mmedia\x1b[22m`);
      for (const [filename, url] of Object.entries(result._media) as [string, string][]) {
        this.appendLog(`  \x1b[34m${filename}\x1b[39m  ${url}`);
      }

      if (this.supportsImages) {
        this.loadFirstImage(result._media);
      }
    }

    this.tui?.requestRender();

    if (!this.persistent) {
      setTimeout(() => this.stop(), 600);
    }
  }

  private async loadFirstImage(media: Record<string, string>): Promise<void> {
    const url = Object.values(media)[0];
    if (!url) return;
    const cleanUrl = url.replace(/ -> .*$/, "").trim();
    const filename = Object.keys(media)[0];

    const data = await fetchImageAsBase64(cleanUrl);
    if (!data) return;

    const dims = getImageDimensions(data.base64, data.mime);
    const imgOptions: any = { filename };
    if (dims) {
      const cellW = Math.floor((this.tui?.terminal.columns || 80) * 0.38);
      const maxCellH = Math.floor((this.tui?.terminal.rows || 24) * 0.7);
      imgOptions.maxWidthCells = cellW;
      imgOptions.maxHeightCells = maxCellH;
    }

    const img = new Image(
      data.base64,
      data.mime,
      { fallbackColor: (s: string) => `\x1b[2m${s}\x1b[22m` },
      imgOptions,
      dims || undefined
    );

    this.imagePanel.set(img, filename);
    this.splitPane.setShowRight(true);
    this.splitPane.invalidate();
    this.tui?.requestRender();
  }

  onFailed(err: Error): void {
    this.ensureStarted();
    this.currentNode = "";
    this.progressValue = 0;
    this.progressMax = 0;
    this.finished = true;

    this.footer.setBg(S.bgFooterErr);
    this.footer.set("\x1b[1m\u2717 failed\x1b[22m", truncateToWidth(err.message, 50));

    this.tui?.requestRender();

    if (!this.persistent) {
      setTimeout(() => this.stop(), 600);
    }
  }

  render(result: RunResult): void {
    console.log(JSON.stringify(result, null, 2));
  }

  info(msg: string): void {
    this.appendLog(`\x1b[2m${msg}\x1b[22m`);
  }

  blank(): void {
    this.appendLog("");
  }

  showWatchStatus(msg: string): void {
    this.appendLog(`\x1b[33m  \u25CE\x1b[39m \x1b[2mwatch\x1b[22m ${msg}`);
  }

  showInterrupt(runNumber: number): void {
    this.appendLog(`\x1b[33m  \u25CE\x1b[39m \x1b[2minterrupted\x1b[22m Run #${runNumber}`);
  }

  showRunComplete(runNumber: number, durationMs: number): void {
    this.appendLog(`\x1b[32m  \u2713\x1b[39m \x1b[1mRun #${runNumber}\x1b[22m \x1b[2m${durationMs}ms\x1b[22m`);
  }

  showRunFailed(runNumber: number, message: string): void {
    this.appendLog(`\x1b[31m  \u2717\x1b[39m \x1b[1mRun #${runNumber}\x1b[22m \x1b[2m${message}\x1b[22m`);
  }
}
