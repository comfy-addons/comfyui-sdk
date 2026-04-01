import React from "react";
import { afterEach, describe, expect, it } from "bun:test";
import { render } from "ink-testing-library";
import { JsonRenderer } from "cli/renderer/json";
import { QuietRenderer } from "cli/renderer/quiet";
import { TerminalRenderer } from "cli/renderer/terminal";
import { ImageBlock } from "cli/renderer/ink/components/image-block";
import { detectTerminalImageProtocol } from "cli/renderer/ink/image-support";
import { INITIAL_STATE, createTuiStore, tuiReducer } from "cli/renderer/ink/state";
import { isInkAvailable, InkTuiRenderer } from "cli/renderer/ink/ink-tui-renderer";

function captureConsole(): { logs: string[]; errors: string[]; stdout: string[]; restore: () => void } {
  const logs: string[] = [];
  const errors: string[] = [];
  const stdout: string[] = [];
  const origLog = console.log;
  const origError = console.error;
  const origWrite = process.stdout.write.bind(process.stdout);

  console.log = (...args: any[]) => {
    logs.push(args.join(" "));
  };
  console.error = (...args: any[]) => {
    errors.push(args.join(" "));
  };
  process.stdout.write = (data: any, ...rest: any[]) => {
    stdout.push(String(data));
    return origWrite(data, ...rest);
  };

  return {
    logs,
    errors,
    stdout,
    restore: () => {
      console.log = origLog;
      console.error = origError;
      process.stdout.write = origWrite;
    }
  };
}

const ORIGINAL_ENV = {
  TERM: process.env.TERM,
  TERM_PROGRAM: process.env.TERM_PROGRAM,
  KITTY_WINDOW_ID: process.env.KITTY_WINDOW_ID
};

const ORIGINAL_FETCH = globalThis.fetch;

afterEach(() => {
  process.env.TERM = ORIGINAL_ENV.TERM;
  process.env.TERM_PROGRAM = ORIGINAL_ENV.TERM_PROGRAM;
  process.env.KITTY_WINDOW_ID = ORIGINAL_ENV.KITTY_WINDOW_ID;
  globalThis.fetch = ORIGINAL_FETCH;
});

describe("JsonRenderer", () => {
  it("should output valid JSON from render", () => {
    const { logs, restore } = captureConsole();

    try {
      const renderer = new JsonRenderer();
      renderer.render({
        status: "completed",
        duration_ms: 1000,
        server: { host: "http://localhost:8188" },
        overrides: {}
      } as any);

      expect(logs).toHaveLength(1);
      expect(JSON.parse(logs[0]).status).toBe("completed");
    } finally {
      restore();
    }
  });
});

describe("QuietRenderer", () => {
  it("should output error message on onFailed", () => {
    const { errors, restore } = captureConsole();

    try {
      const renderer = new QuietRenderer();
      renderer.onFailed(new Error("test error"));
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("test error");
    } finally {
      restore();
    }
  });
});

describe("TerminalRenderer", () => {
  it("should output Connected and host on onConnect", () => {
    const { logs, restore } = captureConsole();

    try {
      const renderer = new TerminalRenderer("http://server:8188", "workflow.json");
      renderer.onConnect();
      expect(logs).toHaveLength(1);
      expect(logs[0]).toContain("Connected");
      expect(logs[0]).toContain("http://server:8188");
    } finally {
      restore();
    }
  });

  it("should output Node and progress info on onProgress", () => {
    const { stdout, restore } = captureConsole();

    try {
      const renderer = new TerminalRenderer("http://server:8188", "workflow.json");
      renderer.onProgress({ value: 10, max: 20, node: "3", prompt_id: "abc" });
      const output = stdout.join(" ");
      expect(output).toContain("Node 3");
      expect(output).toContain("10/20");
    } finally {
      restore();
    }
  });

  it("should render grouped results and image paths on finish", () => {
    const { logs, restore } = captureConsole();

    try {
      const renderer = new TerminalRenderer("http://server:8188", "workflow.json");
      renderer.onFinished({
        status: "completed",
        duration_ms: 2500,
        server: { host: "http://server:8188" },
        overrides: {},
        outputs: { "9": {} },
        _media: { "image.png": "http://server:8188/view?filename=image.png -> /tmp/image.png" }
      });

      expect(logs.some((line) => line.includes("Results"))).toBe(true);
      expect(logs.some((line) => line.includes("output") && line.includes("9"))).toBe(true);
      expect(logs.some((line) => line.includes("/tmp/image.png"))).toBe(true);
    } finally {
      restore();
    }
  });
});

describe("tuiReducer", () => {
  it("should set connected and add feed entry on CONNECT", () => {
    const state = { ...INITIAL_STATE, host: "http://localhost:8188" };
    const next = tuiReducer(state, { type: "CONNECT" });

    expect(next.connected).toBe(true);
    expect(next.status).toBe("idle");
    expect(next.feed).toHaveLength(1);
    expect(next.feed[0].source).toBe("system");
    expect(next.feed[0].tone).toBe("success");
  });

  it("should start a run without clearing prior feed or media", () => {
    const state = {
      ...INITIAL_STATE,
      feed: [{ id: 1, type: "feed" as const, source: "watch" as const, text: "old", tone: "default" as const, runNumber: 1, timestamp: 1 }],
      media: [{ id: 2, type: "image" as const, imageUrl: "http://server/img.png", label: "img.png", localPath: null, timestamp: 2 }]
    };

    const next = tuiReducer(state, { type: "START_RUN", runNumber: 2 });

    expect(next.runNumber).toBe(2);
    expect(next.feed.length).toBeGreaterThan(1);
    expect(next.media).toHaveLength(1);
    expect(next.runStartedAt).not.toBeNull();
  });

  it("should update progress on PROGRESS", () => {
    const next = tuiReducer(INITIAL_STATE, { type: "PROGRESS", value: 5, max: 10, node: "KSampler" });
    expect(next.status).toBe("executing");
    expect(next.progressValue).toBe(5);
    expect(next.progressMax).toBe(10);
    expect(next.currentNode).toBe("KSampler");
  });

  it("should append raw terminal logs as server feed", () => {
    const next = tuiReducer({ ...INITIAL_STATE, runNumber: 4 }, { type: "ADD_SERVER_LOG", message: "sampler step 11/20   " });
    expect(next.feed).toHaveLength(1);
    expect(next.feed[0].source).toBe("server");
    expect(next.feed[0].text).toBe("sampler step 11/20");
  });

  it("should sanitize carriage-return progress logs before rendering", () => {
    const next = tuiReducer(
      { ...INITIAL_STATE, runNumber: 4 },
      {
        type: "ADD_SERVER_LOG",
        message:
          "\u001b[2K\r 95%|█████████▌| 19/20 [00:04<00:00, 4.12it/s]\r100%|██████████| 20/20 [00:04<00:00, 4.12it/s]"
      }
    );

    expect(next.feed).toHaveLength(1);
    expect(next.feed[0].text).toBe("100%|██████████| 20/20 [00:04<00:00, 4.12it/s]");
  });

  it("should set queued status on PENDING", () => {
    const next = tuiReducer({ ...INITIAL_STATE, runNumber: 1 }, { type: "PENDING", promptId: "abc-123" });
    expect(next.status).toBe("queued");
    expect(next.promptId).toBe("abc-123");
    expect(next.feed.at(-1)?.text).toContain("queued as abc-123");
  });

  it("should set failed status and error message on FAILED", () => {
    const next = tuiReducer({ ...INITIAL_STATE, runNumber: 1 }, { type: "FAILED", message: "something broke" });
    expect(next.status).toBe("failed");
    expect(next.errorMessage).toBe("something broke");
    expect(next.lastRunOutcome).toBe("failed");
    expect(next.feed).toHaveLength(1);
  });

  it("should reset progress fields without clearing history on RESET_RUN", () => {
    const state = {
      ...INITIAL_STATE,
      status: "executing" as const,
      currentNode: "KSampler",
      progressValue: 10,
      progressMax: 20,
      promptId: "abc",
      feed: [{ id: 1, type: "feed" as const, source: "watch" as const, text: "keep", tone: "default" as const, runNumber: 1, timestamp: 1 }]
    };

    const next = tuiReducer(state, { type: "RESET_RUN" });

    expect(next.status).toBe("idle");
    expect(next.currentNode).toBe("");
    expect(next.feed).toHaveLength(1);
  });

  it("should trim feed to 700 entries", () => {
    let state = INITIAL_STATE;

    for (let i = 0; i < 800; i++) {
      state = tuiReducer(state, {
        type: "ADD_FEED",
        entry: { type: "feed", source: "system", text: `log ${i}`, tone: "default", runNumber: null }
      });
    }

    expect(state.feed.length).toBe(700);
    expect(state.feed[0].text).toBe("log 100");
  });

  it("should add media entries with parsed local paths on FINISHED", () => {
    const next = tuiReducer({ ...INITIAL_STATE, runNumber: 3 }, {
      type: "FINISHED",
      result: {
        status: "completed",
        duration_ms: 1000,
        server: { host: "http://localhost:8188" },
        overrides: {},
        _media: { "image.png": "http://localhost:8188/view?filename=image.png -> /tmp/image.png" }
      }
    });

    expect(next.status).toBe("done");
    expect(next.media.length).toBe(1);
    expect(next.media[0].localPath).toBe("/tmp/image.png");
    expect(next.lastRunOutcome).toBe("success");
  });

  it("should preserve multiple media previews on FINISHED", () => {
    const next = tuiReducer(
      { ...INITIAL_STATE, runNumber: 3 },
      {
        type: "FINISHED",
        result: {
          status: "completed",
          duration_ms: 1000,
          server: { host: "http://localhost:8188" },
          overrides: {},
          _media: {
            "output.png": "http://localhost:8188/view?filename=output.png -> /tmp/output.png",
            "output2.png": "http://localhost:8188/view?filename=output2.png -> /tmp/output2.png"
          }
        }
      }
    );

    expect(next.media).toHaveLength(2);
    expect(next.media.map((entry) => entry.label)).toEqual(["output.png", "output2.png"]);
  });

  it("should add warning feed on WATCH_STATUS", () => {
    const next = tuiReducer(INITIAL_STATE, { type: "WATCH_STATUS", message: "change detected" });
    expect(next.feed).toHaveLength(1);
    expect(next.feed[0].tone).toBe("warning");
    expect(next.feed[0].text).toContain("change detected");
  });

  it("should add success summary on RUN_COMPLETE", () => {
    const next = tuiReducer(INITIAL_STATE, { type: "RUN_COMPLETE", runNumber: 3, durationMs: 5000 });
    expect(next.feed).toHaveLength(1);
    expect(next.feed[0].tone).toBe("success");
    expect(next.lastRunLabel).toContain("Run #3 completed");
  });

  it("should add failure summary on RUN_FAILED", () => {
    const next = tuiReducer(INITIAL_STATE, { type: "RUN_FAILED", runNumber: 1, message: "OOM" });
    expect(next.feed).toHaveLength(1);
    expect(next.feed[0].tone).toBe("danger");
    expect(next.feed[0].text).toContain("Run #1 failed");
  });
});

describe("createTuiStore", () => {
  it("should initialize with host and watchFile", () => {
    const store = createTuiStore("http://localhost:8188", "workflow.json");
    const state = store.getState();

    expect(state.host).toBe("http://localhost:8188");
    expect(state.watchFile).toBe("workflow.json");
    expect(typeof state.inlineImagesSupported).toBe("boolean");
  });

  it("should notify subscribers on dispatch", () => {
    const store = createTuiStore("http://localhost:8188", "workflow.json");
    let callCount = 0;
    const unsub = store.subscribe(() => callCount++);

    store.dispatch({ type: "CONNECT" });
    store.dispatch({ type: "PENDING", promptId: "abc" });
    expect(callCount).toBe(2);

    unsub();
    store.dispatch({ type: "PROGRESS", value: 1, max: 10, node: "X" });
    expect(callCount).toBe(2);
  });
});

describe("image support", () => {
  it("should detect kitty protocol", () => {
    process.env.TERM = "xterm-kitty";
    process.env.TERM_PROGRAM = "";
    process.env.KITTY_WINDOW_ID = "1";
    expect(detectTerminalImageProtocol()).toBe("kitty");
  });

  it("should render loading state with stable metadata immediately", () => {
    const app = render(
      React.createElement(ImageBlock, {
        url: "http://server/image.png",
        label: "image.png",
        localPath: "/tmp/image.png"
      })
    );

    const frame = app.lastFrame() ?? "";
    expect(frame).toContain("image.png");
    expect(frame).toContain("/tmp/image.png");
    expect(frame).toContain("rendering color preview");
    app.unmount();
  });

  it("should surface ascii conversion failure for non-image files", async () => {
    const app = render(
      React.createElement(ImageBlock, {
        url: "file://sample.json",
        label: "sample.json",
        localPath: "/Users/saintno/Sources/opensources/comfyui-sdk/sample.json"
      })
    );

    await new Promise((resolve) => setTimeout(resolve, 150));
    const frame = app.lastFrame() ?? "";
    expect(frame).toContain("color preview failed");
    app.unmount();
  });
});

describe("isInkAvailable", () => {
  it("should return a boolean", () => {
    expect(typeof isInkAvailable()).toBe("boolean");
  });
});

describe("InkTuiRenderer", () => {
  it("should be constructable with host and file", () => {
    expect(new InkTuiRenderer("http://localhost:8188", "workflow.json", false)).toBeDefined();
  });

  it("should expose watch-mode methods", () => {
    const renderer = new InkTuiRenderer("http://localhost:8188", "workflow.json");

    expect(typeof renderer.startRun).toBe("function");
    expect(typeof renderer.addServerLog).toBe("function");
    expect(typeof renderer.showWatchStatus).toBe("function");
    expect(typeof renderer.showInterrupt).toBe("function");
    expect(typeof renderer.showRunComplete).toBe("function");
    expect(typeof renderer.showRunFailed).toBe("function");
  });
});
