import type { RunResult } from "cli/renderer/json";
import type { ImageProtocol } from "./image-support";
import { detectTerminalImageProtocol, supportsInlineImages } from "./image-support";
import { parseMediaReference } from "cli/runner";

type FeedTone = "default" | "success" | "danger" | "warning" | "muted" | "accent";
type FeedSource = "server" | "watch" | "system" | "result";

type FeedEntry = {
  id: number;
  type: "feed";
  source: FeedSource;
  text: string;
  tone: FeedTone;
  runNumber: number | null;
  timestamp: number;
};

type MediaEntry = {
  id: number;
  type: "image";
  imageUrl: string;
  label: string;
  localPath: string | null;
  timestamp: number;
};

interface TuiState {
  connected: boolean;
  status: "idle" | "connecting" | "queued" | "executing" | "done" | "failed";
  currentNode: string;
  progressValue: number;
  progressMax: number;
  promptId: string;
  feed: FeedEntry[];
  media: MediaEntry[];
  runNumber: number;
  runDuration: number;
  runStartedAt: number | null;
  watchFile: string;
  host: string;
  errorMessage: string | null;
  lastRunOutcome: "idle" | "success" | "failed" | "interrupted";
  lastRunLabel: string;
  imageProtocol: ImageProtocol;
  inlineImagesSupported: boolean;
}

type FeedEntryInput = Omit<FeedEntry, "id" | "timestamp">;
type MediaEntryInput = Omit<MediaEntry, "id" | "timestamp">;

type TuiAction =
  | { type: "ADD_FEED"; entry: FeedEntryInput }
  | { type: "ADD_SERVER_LOG"; message: string }
  | { type: "CONNECT" }
  | { type: "START_RUN"; runNumber: number }
  | { type: "PENDING"; promptId: string }
  | { type: "PROGRESS"; value: number; max: number; node: string }
  | { type: "OUTPUT"; key: string }
  | { type: "FINISHED"; result: RunResult }
  | { type: "FAILED"; message: string }
  | { type: "RESET_RUN" }
  | { type: "WATCH_STATUS"; message: string }
  | { type: "INTERRUPT"; runNumber: number }
  | { type: "RUN_COMPLETE"; runNumber: number; durationMs: number }
  | { type: "RUN_FAILED"; runNumber: number; message: string };

const INITIAL_STATE: TuiState = {
  connected: false,
  status: "idle",
  currentNode: "",
  progressValue: 0,
  progressMax: 0,
  promptId: "",
  feed: [],
  media: [],
  runNumber: 0,
  runDuration: 0,
  runStartedAt: null,
  watchFile: "",
  host: "",
  errorMessage: null,
  lastRunOutcome: "idle",
  lastRunLabel: "Waiting for first run",
  imageProtocol: "none",
  inlineImagesSupported: false
};

const MAX_FEED_ENTRIES = 700;

let nextLogId = 0;

function nextId(): number {
  return ++nextLogId;
}

function pushFeed(feed: FeedEntry[], entry: FeedEntryInput): FeedEntry[] {
  const updated = [...feed, { ...entry, id: nextId(), timestamp: Date.now() }];
  if (updated.length > MAX_FEED_ENTRIES) {
    return updated.slice(updated.length - MAX_FEED_ENTRIES);
  }
  return updated;
}

function makeFeedEntry(
  text: string,
  tone: FeedTone,
  source: FeedSource = "system",
  runNumber: number | null = null
): FeedEntryInput {
  return { type: "feed", text, tone, source, runNumber };
}

function makeMediaEntry(imageUrl: string, label: string, localPath: string | null): MediaEntryInput {
  return { type: "image", imageUrl, label, localPath };
}

const ANSI_ESCAPE_PATTERN =
  // eslint-disable-next-line no-control-regex
  /\u001B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001B\\))/g;

function normalizeTerminalMessage(message: string): string {
  return message
    .replace(ANSI_ESCAPE_PATTERN, "")
    .split(/\r+/)
    .at(-1)!
    .replace(/[\u0000-\u0008\u000B-\u001A\u001C-\u001F\u007F]/g, "")
    .replace(/\t/g, " ")
    .replace(/\s+$/g, "");
}

function tuiReducer(state: TuiState, action: TuiAction): TuiState {
  switch (action.type) {
    case "ADD_FEED":
      return { ...state, feed: pushFeed(state.feed, action.entry) };

    case "ADD_SERVER_LOG": {
      const message = normalizeTerminalMessage(action.message);
      if (!message) return state;
      return {
        ...state,
        feed: pushFeed(state.feed, makeFeedEntry(message, "default", "server", state.runNumber || null))
      };
    }

    case "CONNECT":
      return {
        ...state,
        connected: true,
        status: "idle",
        feed: pushFeed(state.feed, makeFeedEntry(`Connected to ${state.host}`, "success", "system"))
      };

    case "START_RUN":
      return {
        ...state,
        status: "connecting",
        runNumber: action.runNumber,
        currentNode: "",
        progressValue: 0,
        progressMax: 0,
        promptId: "",
        runDuration: 0,
        runStartedAt: Date.now(),
        errorMessage: null,
        feed: pushFeed(state.feed, makeFeedEntry(`Run #${action.runNumber} started`, "accent", "watch", action.runNumber))
      };

    case "PENDING":
      return {
        ...state,
        status: "queued",
        promptId: action.promptId,
        feed: pushFeed(
          state.feed,
          makeFeedEntry(`Run #${state.runNumber} queued as ${action.promptId}`, "accent", "watch", state.runNumber || null)
        )
      };

    case "PROGRESS":
      return {
        ...state,
        status: "executing",
        currentNode: action.node,
        progressValue: action.value,
        progressMax: action.max,
        promptId: ""
      };

    case "OUTPUT":
      return {
        ...state,
        feed: pushFeed(
          state.feed,
          makeFeedEntry(`Output ready: ${action.key}`, "success", "result", state.runNumber || null)
        )
      };

    case "FINISHED": {
      let feed = state.feed;
      const media: MediaEntry[] = [];

      if (action.result.outputs) {
        feed = pushFeed(
          feed,
          makeFeedEntry(`Results for Run #${state.runNumber}`, "success", "result", state.runNumber || null)
        );
        for (const key of Object.keys(action.result.outputs)) {
          feed = pushFeed(feed, makeFeedEntry(`Output: ${key}`, "success", "result", state.runNumber || null));
        }
      }

      if (action.result._media) {
        for (const [filename, url] of Object.entries(action.result._media)) {
          const parsed = parseMediaReference(String(url));
          feed = pushFeed(
            feed,
            makeFeedEntry(
              parsed.localPath ? `Image: ${filename} saved to ${parsed.localPath}` : `Image: ${filename}`,
              "success",
              "result",
              state.runNumber || null
            )
          );
          media.push({ ...makeMediaEntry(parsed.url, filename, parsed.localPath), id: nextId(), timestamp: Date.now() });
        }
      }

      return {
        ...state,
        status: "done",
        runDuration: action.result.duration_ms,
        runStartedAt: null,
        lastRunOutcome: "success",
        lastRunLabel: `Run #${state.runNumber} completed in ${formatDuration(action.result.duration_ms)}`,
        feed,
        media
      };
    }

    case "FAILED":
      return {
        ...state,
        status: "failed",
        errorMessage: action.message,
        runStartedAt: null,
        lastRunOutcome: "failed",
        lastRunLabel: `Run #${state.runNumber} failed`,
        feed: pushFeed(state.feed, makeFeedEntry(action.message, "danger", "system", state.runNumber || null))
      };

    case "RESET_RUN":
      return {
        ...state,
        status: "idle",
        currentNode: "",
        progressValue: 0,
        progressMax: 0,
        promptId: "",
        runDuration: 0,
        runStartedAt: null,
        errorMessage: null
      };

    case "WATCH_STATUS":
      return {
        ...state,
        feed: pushFeed(state.feed, makeFeedEntry(action.message, "warning", "watch", state.runNumber || null))
      };

    case "INTERRUPT":
      return {
        ...state,
        status: "idle",
        runStartedAt: null,
        lastRunOutcome: "interrupted",
        lastRunLabel: `Run #${action.runNumber} interrupted`,
        feed: pushFeed(
          state.feed,
          makeFeedEntry(`Run #${action.runNumber} interrupted`, "warning", "watch", action.runNumber)
        )
      };

    case "RUN_COMPLETE":
      return {
        ...state,
        runDuration: action.durationMs,
        lastRunOutcome: "success",
        lastRunLabel: `Run #${action.runNumber} completed in ${formatDuration(action.durationMs)}`,
        feed: pushFeed(
          state.feed,
          makeFeedEntry(`Run #${action.runNumber} completed in ${formatDuration(action.durationMs)}`, "success", "watch", action.runNumber)
        )
      };

    case "RUN_FAILED":
      return {
        ...state,
        runStartedAt: null,
        lastRunOutcome: "failed",
        lastRunLabel: `Run #${action.runNumber} failed`,
        feed: pushFeed(
          state.feed,
          makeFeedEntry(`Run #${action.runNumber} failed: ${action.message}`, "danger", "watch", action.runNumber)
        )
      };

    default:
      return state;
  }
}

interface TuiStore {
  getState: () => TuiState;
  dispatch: (action: TuiAction) => void;
  subscribe: (listener: () => void) => () => void;
}

function createTuiStore(host: string, watchFile: string): TuiStore {
  const imageProtocol = detectTerminalImageProtocol();
  let state: TuiState = {
    ...INITIAL_STATE,
    host,
    watchFile,
    imageProtocol,
    inlineImagesSupported: supportsInlineImages(imageProtocol)
  };
  const listeners: Array<() => void> = [];

  return {
    getState() {
      return state;
    },
    dispatch(action: TuiAction) {
      state = tuiReducer(state, action);
      for (let i = 0; i < listeners.length; i++) {
        listeners[i]();
      }
    },
    subscribe(listener: () => void) {
      listeners.push(listener);
      return () => {
        const idx = listeners.indexOf(listener);
        if (idx !== -1) listeners.splice(idx, 1);
      };
    }
  };
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export type { FeedEntry, MediaEntry, TuiState, TuiAction, TuiStore };
export { INITIAL_STATE, tuiReducer, createTuiStore };
